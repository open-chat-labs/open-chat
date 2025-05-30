use crate::guards::caller_is_owner;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use user_canister::cancel_message_reminder::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn cancel_message_reminder(args: Args) -> Response {
    execute_update(|state| cancel_message_reminder_impl(args.reminder_id, state))
}

fn cancel_message_reminder_impl(reminder_id: u64, state: &mut RuntimeState) -> Response {
    let cancelled = state.data.timer_jobs.cancel_jobs(|j| {
        if let TimerJob::MessageReminder(job) = j { job.reminder_id == reminder_id } else { false }
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
