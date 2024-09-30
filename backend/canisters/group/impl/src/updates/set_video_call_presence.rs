use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::SetVideoCallPresenceResult;
use group_canister::set_video_call_presence::{Response::*, *};
use types::Achievement;

#[update(candid = true, msgpack = true)]
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
        } else if member.lapsed.value {
            return UserLapsed;
        }

        let now = state.env.now();
        let user_id = member.user_id;

        if let Some(min_visible_event_index) = state.data.chat.min_visible_event_index(Some(user_id)) {
            match state.data.chat.events.set_video_call_presence(
                user_id,
                args.message_id,
                args.presence,
                min_visible_event_index,
                now,
            ) {
                SetVideoCallPresenceResult::Success => {
                    if args.new_achievement {
                        state.data.achievements.notify_user(
                            user_id,
                            vec![Achievement::JoinedCall],
                            &mut state.data.fire_and_forget_handler,
                        );
                    }

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
