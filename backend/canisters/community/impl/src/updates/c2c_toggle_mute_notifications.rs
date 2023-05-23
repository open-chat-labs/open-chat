use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_toggle_mute_notifications::{Response::*, *};
use types::Timestamped;

#[update_msgpack]
#[trace]
fn c2c_toggle_mute_notifications(args: Args) -> Response {
    mutate_state(|state| c2c_toggle_mute_notifications_impl(args, state))
}

fn c2c_toggle_mute_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller().into();
    let now = state.env.now();
    match state.data.members.get_mut(user_id) {
        Some(member) => {
            member.notifications_muted = Timestamped::new(args.mute, now);
            Success
        }
        None => CallerNotInCommunity,
    }
}
