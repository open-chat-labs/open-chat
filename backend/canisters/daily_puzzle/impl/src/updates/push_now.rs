use crate::guards::caller_is_governance_principal;
use crate::jobs::push_puzzle;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::push_now::*;
use std::time::Duration;
use types::UnitResult;

#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn push_now(_args: Args) -> Response {
    push_puzzle::schedule(true, Duration::ZERO);
    UnitResult::Success
}
