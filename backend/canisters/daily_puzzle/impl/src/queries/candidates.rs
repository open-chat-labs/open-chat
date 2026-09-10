use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::candidates::{Response::*, *};

#[query(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn candidates(args: Args) -> Response {
    read_state(|state| Success(state.data.candidate_views(args.number)))
}
