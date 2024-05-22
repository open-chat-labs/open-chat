use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::SetVideoCallPresenceResult;
use group_canister::set_video_call_presence::{Response::*, *};
use ic_cdk::update;

#[update]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_video_call_presence_impl(args, state))
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();

        if let Some(min_visible_event_index) = state.data.chat.min_visible_event_index(Some(member.user_id)) {
            match state.data.chat.events.set_video_call_presence(
                member.user_id,
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
            UserNotInGroup
        }
    } else {
        UserNotInGroup
    }
}
