use crate::guards::caller_is_owner;
use crate::timer_job_types::{MessageReminderJob, TimerJob};
use crate::{mutate_state, openchat_bot, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use rand_core::RngCore;
use types::{FieldTooLongResult, MessageContent, MessageReminderCreatedContent};
use user_canister::c2c_send_messages::C2CReplyContext;
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

    let reminder_id = state.env.rng().next_u64();

    openchat_bot::send_message_with_reply(
        MessageContent::MessageReminderCreated(MessageReminderCreatedContent {
            reminder_id,
            remind_at: args.remind_at,
            notes: args.notes.clone(),
        }),
        Some(C2CReplyContext::OtherEventList(
            args.chat_id,
            args.thread_root_message_index,
            args.event_index,
        )),
        true,
        state,
    );

    state.data.timer_jobs.enqueue_job(
        TimerJob::MessageReminder(MessageReminderJob {
            reminder_id,
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            event_index: args.event_index,
            notes: args.notes,
        }),
        args.remind_at,
        now,
    );

    Success(reminder_id)
}
