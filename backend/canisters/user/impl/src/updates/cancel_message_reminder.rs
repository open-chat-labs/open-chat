use crate::guards::caller_is_owner;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::cancel_message_reminder::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn cancel_message_reminder(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| cancel_message_reminder_impl(args.reminder_id, state))
}

fn cancel_message_reminder_impl(reminder_id: u64, state: &mut RuntimeState) -> Response {
    let cancelled = state.data.timer_jobs.cancel_jobs(|j| {
        if let TimerJob::MessageReminder(job) = j {
            job.reminder_id == reminder_id
        } else {
            false
        }
    });

    if !cancelled.is_empty() {
        let now = state.env.now();
        if let Some(chat) = state.data.direct_chats.get_mut(&OPENCHAT_BOT_USER_ID.into()) {
            for job in cancelled {
                if let TimerJob::MessageReminder(j) = job {
                    chat.events
                        .mark_message_reminder_created_message_hidden(j.reminder_created_message_index, now);
                }
            }
        }
    }

    Success
}
