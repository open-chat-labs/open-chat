use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::DeleteMessageResult;
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;

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
            if let DeleteMessageResult::Success(content) = runtime_state.data.events.delete_message(
                participant.user_id,
                participant.role.can_delete_messages(),
                message_id,
                now,
            ) {
                files_to_delete.extend(content.blob_references());
            }
        }

        if !files_to_delete.is_empty() {
            ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
