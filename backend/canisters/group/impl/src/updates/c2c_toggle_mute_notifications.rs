use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications::{Response::*, *};
use types::Timestamped;

// TODO: Delete this when FE is using group::toggle_mute_notifications

#[update_msgpack]
#[trace]
fn c2c_toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_toggle_mute_notifications_impl(args, state))
}

fn c2c_toggle_mute_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller().into();
    let now = state.env.now();
    match state.data.chat.members.get_mut(&user_id) {
        Some(member) => {
            member.notifications_muted = Timestamped::new(args.mute, now);
            Success
        }
        None => CallerNotInGroup,
    }
}
