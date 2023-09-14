use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_tracing_macros::trace;
use exchange_bot_canister::swap::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn swap(args: Args) -> Response {
    if let Some(client) = read_state(|state| state.get_swap_client(args.exchange_id, args.input_token, args.output_token)) {
        match client.swap(args.amount).await {
            Ok(amount_out) => Success(amount_out),
            Err(error) => InternalError(format!("{error:?}")),
        }
    } else {
        PairNotSupportedByExchange
    }
}
