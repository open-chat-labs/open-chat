use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{MessageReminderJob, TimerJob};
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, MessageReminderCreatedContentInternal};
use constants::MAX_MESSAGE_REMINDERS;
use multi_user_canister::C2CReplyContext;
use multi_user_canister::set_message_reminder_v2::{Response::*, *};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{Achievement, FieldTooLongResult, OCResult};
use user_core::mentions::replace_mentioned_users;

const MAX_NOTES_LENGTH: usize = 1000;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_message_reminder_v2(args: Args) -> Response {
    match execute_update(|state| set_message_reminder_impl(args, state)) {
        Ok(reminder_id) => Success(reminder_id),
        Err(error) => Error(error),
    }
}

fn set_message_reminder_impl(mut args: Args, state: &mut RuntimeState) -> OCResult<u64> {
    let my_index = state.caller_user_index_or_trap();
    state.with_caller_user(|_, user| user.verify_not_suspended())?;

    // A client which hasn't yet heard that a user has been migrated to a MultiUser canister names
    // them by their old id, both as the other user in a direct chat and when mentioned
    let migrated_user_ids = &state.data.migrated_user_ids;
    args.chat = state.with_caller_user(|_, user| user.direct_chats.latest_chat(args.chat, migrated_user_ids));
    if let Some(notes) = args
        .notes
        .as_ref()
        .and_then(|notes| replace_mentioned_users(notes, |user_id| migrated_user_ids.latest(user_id)))
    {
        args.notes = Some(notes);
    }

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

    let pending_reminders = state
        .data
        .timer_jobs
        .iter()
        .filter(|(_, wrapper)| {
            matches!(wrapper.borrow().as_ref(), Some(TimerJob::MessageReminder(job)) if job.user_index == my_index)
        })
        .count();
    if pending_reminders >= MAX_MESSAGE_REMINDERS {
        return Err(OCErrorCode::LimitReached.with_message(MAX_MESSAGE_REMINDERS));
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
        Some(C2CReplyContext::OtherChat(
            args.chat,
            args.thread_root_message_index,
            args.event_index,
        )),
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
