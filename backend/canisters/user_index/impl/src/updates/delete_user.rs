use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{DeleteUser, UserIndexToLocalUserIndexEvent};
use user_index_canister::delete_user::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn delete_user(args: Args) -> Response {
    mutate_state(|state| delete_user_impl(args, state))
}

fn delete_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user) = state.data.users.get_by_user_id(&args.user_id) else {
        return UserNotFound;
    };

    let caller = state.env.caller();
    if caller != user.principal && caller != user.user_id.into() {
        return NotAuthorized;
    }

    state.delete_user(args.user_id, true);
    state.push_event_to_all_local_user_indexes(
        UserIndexToLocalUserIndexEvent::DeleteUser(DeleteUser {
            user_id: args.user_id,
            triggered_by_user: true,
        }),
        None,
    );
    Success
}
