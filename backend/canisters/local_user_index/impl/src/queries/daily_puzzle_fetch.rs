use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::daily_puzzle_fetch::{Response::*, *};

#[query(guard = "caller_is_openchat_user", msgpack = true)]
fn daily_puzzle_fetch(_args: Args) -> Response {
    read_state(daily_puzzle_fetch_impl)
}

fn daily_puzzle_fetch_impl(state: &RuntimeState) -> Response {
    let user_id = state.calling_user_id();
    let now = state.env.now();
    Success(state.data.daily_puzzle_engine.fetch(user_id, now))
}
