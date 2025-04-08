use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::set_video_call_presence::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::Achievement;

#[update(msgpack = true)]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| set_video_call_presence_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    let caller = state.env.caller();
    let member = state.data.members.get_verified_member(caller)?;
    let user_id = member.user_id;
    let is_bot = member.user_type.is_bot();
    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let min_visible_event_index = channel.chat.min_visible_event_index(Some(user_id))?;

    channel
        .chat
        .events
        .set_video_call_presence(user_id, args.message_id, args.presence, min_visible_event_index, now)?;

    if args.new_achievement && !is_bot {
        state.notify_user_of_achievement(user_id, Achievement::JoinedCall, now);
    }

    handle_activity_notification(state);
    Ok(())
}
