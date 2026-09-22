use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, UserEventPusher, execute_update};
use canister_tracing_macros::trace;
use chat_events::Reader;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::{CallDismissalKind, DirectCallDismissedNotification, DirectChatUserNotificationPayload, OCResult, UserId};
use user_canister::end_video_call_v2::*;

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    execute_update(|state| end_video_call_impl(args, state).into())
}

pub(crate) fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.timer_jobs.cancel_job(|job| {
        if let TimerJob::MarkVideoCallEnded(vc) = job {
            vc.them == args.them && vc.message_id == args.message_id
        } else {
            false
        }
    });

    if let Some(chat) = state.data.user.direct_chats.get_mut(&args.them.into()) {
        let now = state.env.now();
        let my_user_id: UserId = state.env.canister_id().into();
        let was_started_by_me = chat
            .events()
            .main_events_reader()
            .message_internal(args.message_id.into())
            .map(|m| m.sender != args.them)
            .unwrap_or_default();
        let i_was_in_the_call = chat
            .events()
            .video_call_participants_of(args.message_id)
            .contains(&my_user_id);
        let muted = chat.notifications_muted.value;

        chat.end_video_call(
            args.message_id.into(),
            now,
            was_started_by_me.then_some(UserEventPusher {
                now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }),
        )?;

        // whichever of this user's devices is still ringing for the call should stop
        if !muted {
            let dismissal = DirectChatUserNotificationPayload::DirectCallDismissed(DirectCallDismissedNotification {
                them: args.them,
                message_id: args.message_id,
                kind: if i_was_in_the_call { CallDismissalKind::AnsweredElsewhere } else { CallDismissalKind::Ended },
            });
            state.push_notification(None, my_user_id, dismissal);
        }
        Ok(())
    } else {
        Err(OCErrorCode::MessageNotFound.into())
    }
}
