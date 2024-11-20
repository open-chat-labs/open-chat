use crate::guards::caller_is_group_index_or_local_group_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_name_and_members::{Response::*, *};

#[query(guard = "caller_is_group_index_or_local_group_index", msgpack = true)]
fn c2c_name_and_members(_args: Args) -> Response {
    read_state(c2c_name_and_members_impl)
}

fn c2c_name_and_members_impl(state: &RuntimeState) -> Response {
    let members = state.data.chat.members.iter().map(|p| p.user_id()).collect();

    Success(SuccessResult {
        name: state.data.chat.name.value.clone(),
        members,
    })
}
