use crate::{regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::DeleteMessageResult;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CanisterId, MessageId};
use user_canister::c2c_delete_messages;
use user_canister::delete_messages::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn delete_messages(args: Args) -> Response {
    regular_jobs::run();

    RUNTIME_STATE.with(|state| delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let deleted: Vec<_> = args
            .message_ids
            .into_iter()
            .filter(|id| {
                matches!(
                    chat.events.delete_message(my_user_id, false, *id, now),
                    DeleteMessageResult::Success
                )
            })
            .collect();

        if !deleted.is_empty() {
            ic_cdk::block_on(delete_on_recipients_canister(args.user_id.into(), deleted));
        }

        Success
    } else {
        ChatNotFound
    }
}

async fn delete_on_recipients_canister(canister_id: CanisterId, message_ids: Vec<MessageId>) {
    let args = c2c_delete_messages::Args { message_ids };
    let _ = user_canister_c2c_client::c2c_delete_messages(canister_id, &args).await;
}
