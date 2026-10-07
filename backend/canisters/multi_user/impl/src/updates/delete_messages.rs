use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{HardDeleteMessageContentJob, TimerJob};
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::DeleteUndeleteMessagesArgs;
use constants::{MINUTE_IN_MS, OPENCHAT_BOT_USER_ID};
use oc_error_codes::OCErrorCode;
use types::{Achievement, ChatId, EventIndex, MessageId, MessageIndex, OCResult};
use user_canister::delete_messages::*;
use user_canister::{DeleteUndeleteMessagesArgs as C2CDeleteUndeleteMessagesArgs, UserCanisterEvent};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn delete_messages(args: Args) -> Response {
    execute_update(|state| delete_messages_impl(args, state)).into()
}

fn delete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    // Delete the messages in the caller's copy of the chat, where they can delete the other user's
    // messages as well as their own. Unlike the User canister, which passes no thread, this deletes
    // messages within threads too.
    let (deleted, my_messages, thread_root_message_id) = state
        .data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            user.verify_not_suspended()?;

            let mut chat = user.direct_chats.get_mut_or_err(&args.user_id.into())?;

            let mut deleted = Vec::new();
            let mut my_messages = Vec::new();
            for (message_id, result) in chat.delete_messages(
                DeleteUndeleteMessagesArgs {
                    caller: my_user_id,
                    is_admin: true,
                    min_visible_event_index: EventIndex::default(),
                    thread_root_message_index: args.thread_root_message_index,
                    message_ids: args.message_ids,
                    now,
                },
                &state.data.migrated_user_ids,
            ) {
                if let Ok(success) = result {
                    deleted.push(message_id);
                    // Including their messages sent under an earlier id, from before they were migrated
                    if state.data.migrated_user_ids.is_same_user(success.sender, my_user_id) {
                        my_messages.push(message_id);
                    }
                }
            }

            let thread_root_message_id = if my_messages.is_empty() {
                None
            } else {
                chat.thread_root_message_id(args.thread_root_message_index)?
            };
            Ok((deleted, my_messages, thread_root_message_id))
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    let any_deleted = !deleted.is_empty();
    enqueue_hard_delete_jobs(my_index, args.user_id.into(), args.thread_root_message_index, deleted, state);

    // Only the caller's own messages are deleted in the other user's copy, where the thread is
    // identified by the id of its root message since message indexes differ between the copies
    if !my_messages.is_empty() {
        state.send_user_canister_event(
            my_index,
            args.user_id,
            UserCanisterEvent::DeleteMessages(Box::new(C2CDeleteUndeleteMessagesArgs {
                thread_root_message_id,
                message_ids: my_messages,
            })),
        );
    }

    if any_deleted && args.user_id != OPENCHAT_BOT_USER_ID {
        state.award_achievement_and_notify(my_index, Achievement::DeletedMessage, now);
    }
    Ok(())
}

// Queues the removal of the content of messages deleted from the copy of a chat held by the user at
// `user_index`, once the time in which they can be undeleted has passed
pub(crate) fn enqueue_hard_delete_jobs(
    user_index: u16,
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_ids: Vec<MessageId>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
    for message_id in message_ids {
        state.data.timer_jobs.enqueue_job(
            TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                user_index,
                chat_id,
                thread_root_message_index,
                message_id,
            })),
            remove_deleted_message_content_at,
            now,
        );
    }
}
