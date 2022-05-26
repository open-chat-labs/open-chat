use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, DeleteMessageResult};
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;
use types::MessageUnpinned;

#[update]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_messages_impl(args, state))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        let mut files_to_delete = Vec::new();

        for message_id in args.message_ids {
            if let Some(message_index) = runtime_state.data.events.get_message_index(message_id) {
                // If the message being deleted is pinned, unpin it
                if let Ok(index) = runtime_state.data.pinned_messages.binary_search(&message_index) {
                    runtime_state.data.pinned_messages.remove(index);

                    runtime_state.data.events.push_event(
                        ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                            message_index,
                            unpinned_by: participant.user_id,
                            due_to_message_deleted: true,
                        })),
                        runtime_state.env.now(),
                    );
                }
            }

            if let DeleteMessageResult::Success(content) = runtime_state.data.events.delete_message(
                participant.user_id,
                participant.role.can_delete_messages(&runtime_state.data.permissions),
                message_id,
                now,
            ) {
                files_to_delete.extend(content.blob_references());
            }
        }

        if !files_to_delete.is_empty() {
            let file_references = files_to_delete.iter().map(|br| (br.canister_id, br.blob_id)).collect();
            ic_cdk::spawn(open_storage_bucket_client::delete_files(file_references));
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
