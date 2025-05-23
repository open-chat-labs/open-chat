use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::set_video_call_presence::*;
use types::{Achievement, OCResult};

#[update(msgpack = true)]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    execute_update(|state| set_video_call_presence_impl(args, state)).into()
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();

    state
        .data
        .chat
        .set_video_call_presence(user_id, args.message_id, args.presence, now)?;

    if args.new_achievement && !state.data.chat.members.bots().contains_key(&user_id) {
        state.notify_user_of_achievement(user_id, Achievement::JoinedCall, now);
    }

    handle_activity_notification(state);
    Ok(())
}
