use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::initial_state::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    Success(user_core::queries::initial_state(
        &state.data.user,
        state.env.canister_id().into(),
        state.data.local_user_index_canister_id,
        state.env.now(),
    ))
}
