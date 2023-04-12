use crate::guards::caller_is_owner;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, EventIndex, MessageIndex};
use user_canister::clear_message_reminder::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn clear_message_reminder(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| clear_message_reminder_impl(args.chat_id, args.thread_root_message_index, args.event_index, state));

    Success
}

pub(crate) fn clear_message_reminder_impl(
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    event_index: EventIndex,
    state: &mut RuntimeState,
) {
    state.data.timer_jobs.cancel_jobs(|j| {
        if let TimerJob::MessageReminder(job) = j {
            job.chat_id == chat_id
                && job.thread_root_message_index == thread_root_message_index
                && job.event_index == event_index
        } else {
            false
        }
    });
}
