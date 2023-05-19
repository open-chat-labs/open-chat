use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications::{Response::*, *};
use types::Timestamped;

#[update_msgpack]
#[trace]
fn c2c_toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_toggle_mute_notifications_impl(args, state))
}

fn c2c_toggle_mute_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    match runtime_state.data.chat.members.get_mut(&user_id) {
        Some(member) => {
            member.notifications_muted = Timestamped::new(args.mute, now);
            Success
        }
        None => CallerNotInGroup,
    }
}
