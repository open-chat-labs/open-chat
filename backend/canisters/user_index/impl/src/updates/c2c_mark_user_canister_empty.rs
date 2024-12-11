use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{DeleteUser, UserIndexEvent};
use user_index_canister::c2c_mark_user_canister_empty::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn c2c_mark_user_canister_empty(_args: Args) -> Response {
    mutate_state(c2c_mark_user_canister_empty_impl)
}

fn c2c_mark_user_canister_empty_impl(state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller().into();
    if state.data.users.get_by_user_id(&user_id).is_some() {
        state.data.empty_users.insert(user_id);
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::DeleteUser(DeleteUser {
                user_id,
                triggered_by_user: false,
            }),
            None,
        );
    }
    Success
}
