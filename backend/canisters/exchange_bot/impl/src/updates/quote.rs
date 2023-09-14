use crate::guards::caller_is_governance_principal;
use crate::swap_client::SwapClient;
use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use exchange_bot_canister::quote::{Response::*, *};
use exchange_bot_canister::ExchangeId;
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn quote(args: Args) -> Response {
    let PrepareResult { clients } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let futures: Vec<_> = clients.into_iter().map(|c| quote_single(c, args.amount)).collect();

    let results = futures::future::join_all(futures).await;

    let mut quotes = Vec::new();
    let mut failures = Vec::new();
    for (exchange_id, result) in results {
        match result {
            Ok(amount_out) => quotes.push(Quote { exchange_id, amount_out }),
            Err(error) => failures.push(Failure { exchange_id, error }),
        }
    }

    if failures.is_empty() {
        Success(quotes)
    } else if quotes.is_empty() {
        Failed(failures)
    } else {
        PartialSuccess(PartialSuccessResult { quotes, failures })
    }
}

struct PrepareResult {
    clients: Vec<Box<dyn SwapClient>>,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    match state.data.get_token_info(args.input_token, args.output_token) {
        Ok((input_token, output_token)) => {
            let clients = state.get_all_swap_clients(input_token, output_token);
            if !clients.is_empty() {
                Ok(PrepareResult { clients })
            } else {
                Err(PairNotSupported)
            }
        }
        Err(tokens) => Err(UnsupportedTokens(tokens)),
    }
}

async fn quote_single(client: Box<dyn SwapClient>, amount: u128) -> (ExchangeId, Result<u128, String>) {
    let result = client.quote(amount).await.map_err(|e| format!("{e:?}"));

    (client.exchange_id(), result)
}
