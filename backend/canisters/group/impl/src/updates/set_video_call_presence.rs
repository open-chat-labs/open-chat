use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::set_video_call_presence::*;
use types::{Achievement, CallDismissalKind, OCResult, VideoCallPresence};

#[update(candid = true, msgpack = true)]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    execute_update(|state| set_video_call_presence_impl(args, state)).into()
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();

    let hidden = matches!(args.presence, VideoCallPresence::Hidden);
    let result = state
        .data
        .chat
        .set_video_call_presence(user_id, args.message_id, args.presence, now)?;

    if args.new_achievement && !state.data.chat.members.bots().contains_key(&user_id) {
        state.notify_user_of_achievement(user_id, Achievement::JoinedCall, now);
    }

    // this user has answered: any other device of theirs that is still ringing should stop
    if !hidden {
        state.push_call_dismissal(args.message_id, CallDismissalKind::AnsweredElsewhere, vec![user_id]);
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
