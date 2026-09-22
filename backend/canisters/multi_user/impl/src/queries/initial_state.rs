use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::initial_state::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();

    state.with_caller_user(|my_index, user| {
        Success(user.initial_state(state.user_id(my_index), state.data.local_user_index_canister_id, now))
    })
}
