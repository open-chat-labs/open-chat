use crate::guards::caller_is_governance_principal;
use crate::read_state;
use crate::swap_client::SwapClient;
use canister_tracing_macros::trace;
use exchange_bot_canister::quote::*;
use exchange_bot_canister::ExchangeId;
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn quote(args: Args) -> Response {
    let clients = read_state(|state| state.get_all_swap_clients(args.input_token, args.output_token));

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

    Response { quotes, failures }
}

async fn quote_single(client: Box<dyn SwapClient>, amount: u128) -> (ExchangeId, Result<u128, String>) {
    let result = client.quote(amount).await.map_err(|e| format!("{e:?}"));

    (client.exchange_id(), result)
}
