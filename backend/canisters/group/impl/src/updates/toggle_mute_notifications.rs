use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::toggle_mute_notifications::{Response::*, *};
use ic_cdk::update;
use types::Timestamped;

#[update]
#[trace]
fn toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| toggle_mute_notifications_impl(args, state))
}

fn toggle_mute_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    match state.data.get_member_mut(caller) {
        Some(member) => {
            member.notifications_muted = Timestamped::new(args.mute, now);
            let user_id = member.user_id;
            state.data.mark_group_updated_in_user_canister(user_id);
            Success
        }
        None => CallerNotInGroup,
    }
}
