use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserDeleted};
use user_index_canister::delete_user::{Response::*, *};

#[update]
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

    let now = state.env.now();
    state.data.users.delete_user(args.user_id, now);
    state.push_event_to_all_local_user_indexes(Event::UserDeleted(UserDeleted { user_id: args.user_id }), None);
    Success
}
