use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use user_canister::cancel_message_reminder::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn cancel_message_reminder(args: Args) -> Response {
    mutate_state(|state| cancel_message_reminder_impl(args.reminder_id, state))
}

fn cancel_message_reminder_impl(reminder_id: u64, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();

    // Reminder ids are random, but the user's index is matched too so that no user can cancel
    // another's reminder
    let cancelled = state.data.timer_jobs.cancel_jobs(|j| {
        if let TimerJob::MessageReminder(job) = j {
            job.user_index == my_index && job.reminder_id == reminder_id
        } else {
            false
        }
    });

    if !cancelled.is_empty() {
        let now = state.env.now();
        let _ = state.with_direct_chat_mut(my_index, OPENCHAT_BOT_USER_ID.into(), |chat| {
            for job in cancelled {
                if let TimerJob::MessageReminder(j) = job {
                    chat.mark_message_reminder_created_message_hidden(j.reminder_created_message_index, now);
                }
            }
        });
    }

    Response::Success
}
