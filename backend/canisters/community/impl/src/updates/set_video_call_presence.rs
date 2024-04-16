use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::SetVideoCallPresenceResult;
use community_canister::set_video_call_presence::{Response::*, *};
use ic_cdk_macros::update;

#[update]
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

    let user_id = match state.data.members.get(caller) {
        Some(member) if member.suspended.value => return UserSuspended,
        Some(member) => member.user_id,
        None => return UserNotInCommunity,
    };

    let now = state.env.now();

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        if let Some(min_visible_event_index) = channel.chat.min_visible_event_index(Some(user_id)) {
            match channel.chat.events.set_video_call_presence(
                user_id,
                args.message_id,
                args.presence,
                min_visible_event_index,
                now,
            ) {
                SetVideoCallPresenceResult::Success => {
                    handle_activity_notification(state);
                    Success
                }
                SetVideoCallPresenceResult::MessageNotFound => MessageNotFound,
                SetVideoCallPresenceResult::AlreadyEnded => AlreadyEnded,
            }
        } else {
            UserNotInChannel
        }
    } else {
        ChannelNotFound
    }
}
