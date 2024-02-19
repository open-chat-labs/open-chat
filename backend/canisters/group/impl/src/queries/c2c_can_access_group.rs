use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::c2c_can_access_group::{Response::*, *};
use types::UserId;

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_access_group(args: Args) -> Response {
    read_state(|state| c2c_can_access_group_impl(args.user_id, state))
}

fn c2c_can_access_group_impl(user_id: UserId, state: &RuntimeState) -> Response {
    match state.data.chat.members.get(&user_id).is_some() {
        true => Yes,
        false => No,
    }
}
