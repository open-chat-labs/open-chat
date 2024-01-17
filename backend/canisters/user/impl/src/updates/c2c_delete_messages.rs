use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{DeleteMessageResult, DeleteUndeleteMessagesArgs};
use types::{ChatId, EventIndex, UserId};
use user_canister::c2c_delete_messages::{Response::*, *};
use utils::time::MINUTE_IN_MS;

#[update_msgpack]
#[trace]
fn c2c_delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_delete_messages_impl(args, state.env.caller().into(), state))
}

pub(crate) fn c2c_delete_messages_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    if state.data.blocked_users.contains(&caller_user_id) {
        return UserBlocked;
    }

    let chat_id: ChatId = caller_user_id.into();
    if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
        let now = state.env.now();

        let delete_message_results = chat.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: caller_user_id,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: args.message_ids,
            now,
        });

        let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
        for (message_id, result) in delete_message_results {
            if matches!(result, DeleteMessageResult::Success(_)) {
                state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                        chat_id,
                        thread_root_message_index: None,
                        message_id,
                    })),
                    remove_deleted_message_content_at,
                    now,
                );
            }
        }

        Success
    } else {
        ChatNotFound
    }
}
