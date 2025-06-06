use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, UserEventPusher, execute_update};
use canister_tracing_macros::trace;
use chat_events::Reader;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::end_video_call_v2::*;

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    execute_update(|state| end_video_call_impl(args, state).into())
}

pub(crate) fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.timer_jobs.cancel_job(
        |job| {
            if let TimerJob::MarkVideoCallEnded(vc) = job { vc.0 == args } else { false }
        },
    );

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = state.env.now();
        let was_started_by_me = chat
            .events
            .main_events_reader()
            .message_internal(args.message_id.into())
            .map(|m| m.sender != args.user_id)
            .unwrap_or_default();

        chat.events.end_video_call(
            args.message_id.into(),
            now,
            was_started_by_me.then_some(UserEventPusher {
                now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }),
        )?;
        Ok(())
    } else {
        Err(OCErrorCode::MessageNotFound.into())
    }
}
