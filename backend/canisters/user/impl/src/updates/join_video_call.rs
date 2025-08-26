use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, EventIndex, OCResult, UserId, VideoCallPresence};
use user_canister::{JoinVideoCall, UserCanisterEvent, join_video_call::*};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    execute_update(|state| join_video_call_impl(args, state).into())
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if state.data.suspended.value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    if state.data.blocked_users.contains(&args.user_id) {
        return Err(OCErrorCode::TargetUserBlocked.into());
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = state.env.now();
        let my_user_id: UserId = state.env.canister_id().into();

        chat.events.set_video_call_presence(
            my_user_id,
            args.message_id,
            VideoCallPresence::Default,
            EventIndex::default(),
            now,
        )?;

        state.push_user_canister_event(
            args.user_id.into(),
            UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
                message_id: args.message_id,
            })),
        );

        state.award_achievement_and_notify(Achievement::JoinedCall, now);
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
