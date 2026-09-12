use crate::guards::verify_caller_is_platform_operator;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::candidates::{Response::*, *};

/// An update rather than a query because platform operators are known only to the user index.
#[update(candid = true, msgpack = true)]
#[trace]
async fn candidates(args: Args) -> Response {
    if let Err(error) = verify_caller_is_platform_operator().await {
        return Error(error);
    }
    read_state(|state| Success(state.data.candidate_views(args.number)))
}
