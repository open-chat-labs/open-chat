use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::SetVideoCallPresenceResult;
use types::{Achievement, EventIndex, UserId, VideoCallPresence};
use user_canister::{
    join_video_call::{Response::*, *},
    JoinVideoCall, UserCanisterEvent,
};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| join_video_call_impl(args, state))
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if state.data.blocked_users.contains(&args.user_id) {
        return UserBlocked;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = state.env.now();
        let my_user_id: UserId = state.env.canister_id().into();

        match chat.events.set_video_call_presence(
            my_user_id,
            args.message_id,
            VideoCallPresence::Default,
            EventIndex::default(),
            now,
        ) {
            SetVideoCallPresenceResult::Success => {
                state.push_user_canister_event(
                    args.user_id.into(),
                    UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
                        message_id: args.message_id,
                    })),
                );

                state.data.award_achievement_and_notify(Achievement::JoinedCall, now);

                Success
            }
            SetVideoCallPresenceResult::MessageNotFound => MessageNotFound,
            SetVideoCallPresenceResult::AlreadyEnded => AlreadyEnded,
        }
    } else {
        ChatNotFound
    }
}
