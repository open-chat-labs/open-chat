use crate::guards::caller_is_governance_principal;
use crate::swap_client::SwapClient;
use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use exchange_bot_canister::swap::{Response::*, *};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_macros::update;
use types::{icrc1, TokenInfo};

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn swap(args: Args) -> Response {
    let PrepareResult {
        client,
        input_token,
        output_token,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match swap_impl(client, args.amount, input_token, output_token).await {
        Ok(amount_out) => Success(amount_out),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    client: Box<dyn SwapClient>,
    input_token: TokenInfo,
    output_token: TokenInfo,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    match state.data.get_token_info(args.input_token, args.output_token) {
        Ok((input_token, output_token)) => {
            if let Some(client) = state.get_swap_client(args.exchange_id, input_token.clone(), output_token.clone()) {
                Ok(PrepareResult {
                    client,
                    input_token,
                    output_token,
                })
            } else {
                Err(PairNotSupportedByExchange)
            }
        }
        Err(tokens) => Err(UnsupportedTokens(tokens)),
    }
}

async fn swap_impl(
    client: Box<dyn SwapClient>,
    amount: u128,
    input_token: TokenInfo,
    output_token: TokenInfo,
) -> CallResult<u128> {
    let (ledger_canister_id, deposit_account) = client.deposit_account().await?;

    let transfer_args = icrc1::TransferArg {
        from_subaccount: None,
        to: deposit_account,
        fee: Some(input_token.fee.into()),
        created_at_time: None,
        memo: None,
        amount: amount.into(),
    };
    if let Err(error) = icrc1_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, &transfer_args).await? {
        return Err((RejectionCode::Unknown, format!("{error:?}")));
    }

    let amount_deposited = client.deposit(amount.saturating_sub(input_token.fee)).await?;

    let amount_out = client.swap(amount_deposited).await?;

    let amount_withdrawn = client.withdraw(amount_out.saturating_sub(output_token.fee)).await?;

    Ok(amount_withdrawn)
}
