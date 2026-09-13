use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::schedule::{Response::*, *};

// The operator tab pre-fills its schedule form from this; without it the form was write-only
// (#9334 invariant 51).
#[query(candid = true, msgpack = true)]
#[trace]
fn schedule(_args: Args) -> Response {
    read_state(|state| Success(state.data.schedule.clone()))
}
