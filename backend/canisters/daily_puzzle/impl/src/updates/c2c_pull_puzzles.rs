use crate::guards::verify_caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::c2c_pull_puzzles::{Response::*, *};

#[update(msgpack = true)]
#[trace]
async fn c2c_pull_puzzles(_args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    if let Err(error) = verify_caller_is_local_user_index(caller).await {
        return Error(error);
    }
    read_state(|state| Success(state.data.current_puzzles(state.env.now()).into_iter().cloned().collect()))
}
