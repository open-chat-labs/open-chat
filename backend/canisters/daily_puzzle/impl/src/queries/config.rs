use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::config::{Response::*, *};

#[query(candid = true, msgpack = true)]
#[trace]
fn config(_args: Args) -> Response {
    read_state(|state| Success(state.data.config.clone()))
}
