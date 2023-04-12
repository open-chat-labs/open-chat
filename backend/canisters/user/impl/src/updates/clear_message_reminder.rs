use crate::guards::caller_is_owner;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::clear_message_reminder::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn clear_message_reminder(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| clear_message_reminder_impl(args.reminder_id, state))
}

fn clear_message_reminder_impl(reminder_id: u64, state: &mut RuntimeState) -> Response {
    state.data.timer_jobs.cancel_jobs(|j| {
        if let TimerJob::MessageReminder(job) = j {
            job.reminder_id == reminder_id
        } else {
            false
        }
    });

    Success
}
