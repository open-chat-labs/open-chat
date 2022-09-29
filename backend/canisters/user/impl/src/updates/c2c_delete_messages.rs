use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::DeleteMessageResult;
use types::UserId;
use user_canister::c2c_delete_messages::{Response::*, *};

#[update_msgpack]
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

        let delete_message_results =
            chat.events
                .delete_messages(caller, false, None, args.message_ids, args.correlation_id, now);

        let files_to_delete: Vec<_> = delete_message_results
            .into_iter()
            .flat_map(|(_, result)| {
                if let DeleteMessageResult::Success(content) = result {
                    content.blob_references()
                } else {
                    Vec::new()
                }
            })
            .collect();

        if !files_to_delete.is_empty() {
            ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
        }

        Success
    } else {
        ChatNotFound
    }
}
