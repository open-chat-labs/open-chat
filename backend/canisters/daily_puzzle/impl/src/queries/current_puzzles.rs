use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::current_puzzles::{Response::*, *};

#[query(candid = true, msgpack = true)]
#[trace]
fn current_puzzles(_args: Args) -> Response {
    read_state(|state| {
        Success(
            state
                .data
                .current_puzzles(state.env.now())
                .into_iter()
                .map(|p| p.public())
                .collect(),
        )
    })
}
