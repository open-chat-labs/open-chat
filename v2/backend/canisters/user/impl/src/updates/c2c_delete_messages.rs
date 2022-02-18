use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::DeleteMessageResult;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use itertools::Itertools;
use types::{BlobReference, CanisterId, UserId};
use user_canister::c2c_delete_messages::{Response::*, *};

#[update]
#[trace]
fn c2c_delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_delete_messages_impl(args, state))
}

fn c2c_delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        let mut files_to_delete = Vec::new();

        for message_id in args.message_ids {
            if let DeleteMessageResult::Success(content) = chat.events.delete_message(caller, false, message_id, now) {
                files_to_delete.extend(content.blob_references());
            }
        }

        if !files_to_delete.is_empty() {
            ic_cdk::spawn(delete_files(files_to_delete));
        }

        Success
    } else {
        ChatNotFound
    }
}

async fn delete_files(blob_references: Vec<BlobReference>) {
    async fn delete_files_inner(
        canister_id: CanisterId,
        blob_ids: Vec<u128>,
    ) -> CallResult<open_storage_bucket_canister::delete_files::Response> {
        let args = open_storage_bucket_canister::delete_files::Args { file_ids: blob_ids };

        open_storage_bucket_canister_c2c_client::delete_files(canister_id, &args).await
    }

    let mut futures = Vec::new();

    for (canister_id, grouping) in &blob_references.into_iter().group_by(|br| br.canister_id) {
        let blob_ids: Vec<_> = grouping.map(|g| g.blob_id).collect();
        futures.push(delete_files_inner(canister_id, blob_ids));
    }

    futures::future::join_all(futures).await;
}
