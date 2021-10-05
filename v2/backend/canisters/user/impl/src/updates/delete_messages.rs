use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::DeleteMessageResult;
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::{CanisterId, MessageId};
use user_canister::c2c_delete_messages;
use user_canister::delete_messages::{Response::*, *};

#[update]
fn delete_messages(args: Args) -> Response {
    check_cycles_balance();

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
            .filter(|id| matches!(chat.events.delete_message(my_user_id, *id, now), DeleteMessageResult::Success))
            .collect();

        if !deleted.is_empty() {
            for deleted_message in deleted.iter() {
                // We can remove from 'replies_map' since the message is now deleted
                if let Some(replies) = chat.replies_map.remove(deleted_message) {
                    for reply_message_id in replies.iter() {
                        chat.events.mark_reply_context_updated(*reply_message_id, now);
                    }
                }
            }
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
