use crate::guards::verify_caller_is_platform_operator;
use crate::jobs::push_puzzle;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::push_now::*;
use std::time::Duration;
use types::UnitResult;

#[update(candid = true, msgpack = true)]
#[trace]
async fn push_now(_args: Args) -> Response {
    if let Err(error) = verify_caller_is_platform_operator().await {
        return UnitResult::Error(error);
    }
    push_puzzle::schedule(true, Duration::ZERO);
    UnitResult::Success
}
