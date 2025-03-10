use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::toggle_mute_notifications::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| toggle_mute_notifications_impl(args, state))
}

fn toggle_mute_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    if let Some(user_id) = state.data.lookup_user_id(caller) {
        if matches!(
            state.data.chat.members.toggle_notifications_muted(user_id, args.mute, now),
            Some(true)
        ) {
            state.data.mark_group_updated_in_user_canister(user_id);
        }
        Success
    } else {
        CallerNotInGroup
    }
}
