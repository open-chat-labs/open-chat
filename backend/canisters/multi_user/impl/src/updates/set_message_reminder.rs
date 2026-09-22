use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{MessageReminderJob, TimerJob};
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, MessageReminderCreatedContentInternal, ReplyContextInternal};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{Achievement, FieldTooLongResult, OCResult};
use user_canister::set_message_reminder_v2::{Response::*, *};

const MAX_NOTES_LENGTH: usize = 1000;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_message_reminder_v2(args: Args) -> Response {
    match mutate_state(|state| set_message_reminder_impl(args, state)) {
        Ok(reminder_id) => Success(reminder_id),
        Err(error) => Error(error),
    }
}

fn set_message_reminder_impl(args: Args, state: &mut RuntimeState) -> OCResult<u64> {
    let my_index = state.caller_user_index_or_trap();
    state.with_caller_user(|_, user| user.verify_not_suspended())?;

    let now = state.env.now();
    if args.remind_at <= now {
        return Err(OCErrorCode::DateInThePast.into());
    }

    let notes_len = args.notes.as_ref().map(|n| n.chars().count()).unwrap_or_default();
    if notes_len > MAX_NOTES_LENGTH {
        return Err(OCErrorCode::TextTooLong.with_json(&FieldTooLongResult {
            length_provided: notes_len as u32,
            max_length: MAX_NOTES_LENGTH as u32,
        }));
    }

    let reminder_id = state.env.rng().next_u64();

    let reminder_created_message_index = openchat_bot::send_message_with_reply(
        my_index,
        MessageContentInternal::MessageReminderCreated(MessageReminderCreatedContentInternal {
            reminder_id,
            remind_at: args.remind_at,
            notes: args.notes.clone(),
            hidden: false,
        }),
        Some(ReplyContextInternal {
            chat_if_other: Some((args.chat.into(), args.thread_root_message_index)),
            event_index: args.event_index,
        }),
        Vec::new(),
        true,
        state,
    )
    .ok_or(OCErrorCode::InitiatorNotFound)?
    .event
    .message_index;

    state.data.timer_jobs.enqueue_job(
        TimerJob::MessageReminder(Box::new(MessageReminderJob {
            user_index: my_index,
            reminder_id,
            chat: args.chat,
            thread_root_message_index: args.thread_root_message_index,
            event_index: args.event_index,
            notes: args.notes,
            reminder_created_message_index,
        })),
        args.remind_at,
        now,
    );

    state.award_achievement_and_notify(my_index, Achievement::SentReminder, now);

    Ok(reminder_id)
}
