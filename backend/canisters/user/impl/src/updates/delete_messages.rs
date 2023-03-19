use crate::guards::caller_is_owner;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{DeleteMessageResult, DeleteUndeleteMessagesArgs};
use ic_cdk_macros::update;
use types::{CanisterId, EventIndex, MessageId};
use user_canister::c2c_delete_messages;
use user_canister::delete_messages::{Response::*, *};
use utils::time::MINUTE_IN_MS;

#[update(guard = "caller_is_owner")]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_messages_impl(args, state))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let delete_message_results = chat.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: my_user_id,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: args.message_ids,
            now,
        });

        let deleted: Vec<_> = delete_message_results
            .into_iter()
            .filter_map(|(message_id, result)| matches!(result, DeleteMessageResult::Success).then_some(message_id))
            .collect();

        if !deleted.is_empty() {
            let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
            for message_id in deleted.iter().copied() {
                runtime_state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                        chat_id: args.user_id.into(),
                        thread_root_message_index: None,
                        message_id,
                        delete_files: true,
                    })),
                    remove_deleted_message_content_at,
                    now,
                );
            }

            ic_cdk::spawn(delete_on_recipients_canister(
                args.user_id.into(),
                deleted,
                args.correlation_id,
            ));
        }

        Success
    } else {
        ChatNotFound
    }
}

// TODO retry this if it fails
async fn delete_on_recipients_canister(canister_id: CanisterId, message_ids: Vec<MessageId>, correlation_id: u64) {
    let args = c2c_delete_messages::Args {
        message_ids,
        correlation_id,
    };
    let _ = user_canister_c2c_client::c2c_delete_messages(canister_id, &args).await;
}
