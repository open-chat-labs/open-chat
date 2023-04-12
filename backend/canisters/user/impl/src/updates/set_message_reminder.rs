use crate::guards::caller_is_owner;
use crate::timer_job_types::{MessageReminderJob, TimerJob};
use crate::updates::clear_message_reminder::clear_message_reminder_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::FieldTooLongResult;
use user_canister::set_message_reminder::{Response::*, *};

const MAX_NOTES_LENGTH: usize = 1000;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_message_reminder(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_message_reminder_impl(args, state))
}

fn set_message_reminder_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    let now = state.env.now();
    if args.remind_at <= now {
        return ReminderDateInThePast;
    }

    let notes_len = args.notes.as_ref().map(|n| n.len()).unwrap_or_default();
    if notes_len > MAX_NOTES_LENGTH {
        return NotesTooLong(FieldTooLongResult {
            length_provided: notes_len as u32,
            max_length: MAX_NOTES_LENGTH as u32,
        });
    }

    clear_message_reminder_impl(args.chat_id, args.thread_root_message_index, args.event_index, state);

    state.data.timer_jobs.enqueue_job(
        TimerJob::MessageReminder(MessageReminderJob {
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            event_index: args.event_index,
            notes: args.notes,
        }),
        args.remind_at,
        now,
    );

    Success
}
