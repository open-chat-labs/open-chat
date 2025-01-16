use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EndVideoCallResult, Reader};
use ic_cdk::update;
use user_canister::end_video_call_v2::{Response::*, *};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call(args: ArgsV1) -> Response {
    run_regular_jobs();

    mutate_state(|state| end_video_call_impl(args.into(), state))
}

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| end_video_call_impl(args, state))
}

pub(crate) fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.timer_jobs.cancel_job(
        |job| {
            if let TimerJob::MarkVideoCallEnded(vc) = job {
                vc.0 == args
            } else {
                false
            }
        },
    );

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let was_started_by_me = chat
            .events
            .main_events_reader()
            .message_internal(args.message_id.into())
            .map(|m| m.sender != args.user_id)
            .unwrap_or_default();

        match chat.events.end_video_call(
            args.message_id.into(),
            state.env.now(),
            was_started_by_me.then_some(&mut state.data.event_store_client),
        ) {
            EndVideoCallResult::Success => Success,
            EndVideoCallResult::MessageNotFound => MessageNotFound,
            EndVideoCallResult::AlreadyEnded => AlreadyEnded,
        }
    } else {
        MessageNotFound
    }
}
