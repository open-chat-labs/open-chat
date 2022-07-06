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

        let mut files_to_delete = Vec::new();

        for message_id in args.message_ids {
            if let DeleteMessageResult::Success(content) = chat.events.delete_message(caller, false, None, message_id, now) {
                files_to_delete.extend(content.blob_references());
            }
        }

        if !files_to_delete.is_empty() {
            ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
        }

        Success
    } else {
        ChatNotFound
    }
}
