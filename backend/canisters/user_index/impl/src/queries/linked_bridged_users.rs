use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::linked_bridged_users::{Response::*, *};

#[query(guard = "caller_is_openchat_user", msgpack = true)]
fn linked_bridged_users(_args: Args) -> Response {
    read_state(linked_bridged_users_impl)
}

fn linked_bridged_users_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let linked = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|user| state.data.bridged_users.linked_to(user.user_id))
        .unwrap_or_default();

    Success(linked)
}
