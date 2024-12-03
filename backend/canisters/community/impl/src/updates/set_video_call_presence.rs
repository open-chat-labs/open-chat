use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::SetVideoCallPresenceResult;
use community_canister::set_video_call_presence::{Response::*, *};
use group_chat_core::MinVisibleEventIndexResult;
use types::Achievement;

#[update(msgpack = true)]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_video_call_presence_impl(args, state))
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    let (user_id, is_bot) = match state.data.members.get(caller) {
        Some(member) if member.suspended().value => return UserSuspended,
        Some(member) if member.lapsed().value => return UserLapsed,
        Some(member) => (member.user_id, member.user_type.is_bot()),
        None => return UserNotInCommunity,
    };

    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return ChannelNotFound;
    };

    let min_visible_event_index = match channel.chat.min_visible_event_index(Some(user_id)) {
        MinVisibleEventIndexResult::Success(event_index) => event_index,
        MinVisibleEventIndexResult::UserLapsed => return UserLapsed,
        MinVisibleEventIndexResult::UserSuspended => return UserSuspended,
        MinVisibleEventIndexResult::UserNotInGroup => return UserNotInChannel,
    };

    match channel
        .chat
        .events
        .set_video_call_presence(user_id, args.message_id, args.presence, min_visible_event_index, now)
    {
        SetVideoCallPresenceResult::Success => {
            if args.new_achievement && !is_bot {
                state.data.notify_user_of_achievement(user_id, Achievement::JoinedCall);
            }

            handle_activity_notification(state);
            Success
        }
        SetVideoCallPresenceResult::MessageNotFound => MessageNotFound,
        SetVideoCallPresenceResult::AlreadyEnded => AlreadyEnded,
    }
}
