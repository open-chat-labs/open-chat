use crate::guards::verify_caller_is_platform_operator;
use crate::jobs::push_puzzle;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::set_enabled::*;
use std::time::Duration;
use types::UnitResult;

#[update(candid = true, msgpack = true)]
#[trace]
async fn set_enabled(args: Args) -> Response {
    if let Err(error) = verify_caller_is_platform_operator().await {
        return UnitResult::Error(error);
    }
    mutate_state(|state| state.data.set_enabled(args.enabled));
    push_puzzle::schedule(true, Duration::ZERO);
    UnitResult::Success
}
