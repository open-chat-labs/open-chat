use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::chat_id::DirectChatId;
use types::{CanisterId, MessageIndex};
use user_canister::updates::handle_mark_read;
use user_canister::updates::mark_read::{Response::*, *};

#[update]
fn mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let chat_id = DirectChatId::from((&runtime_state.env.canister_id().into(), &args.user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
            if chat.latest_read_by_me < args.up_to_message_index {
                chat.latest_read_by_me = args.up_to_message_index;
                ic_cdk::block_on(mark_read_on_recipients_canister(
                    args.user_id.into(),
                    args.up_to_message_index,
                ));
                Success
            } else {
                SuccessNoChange
            }
        } else {
            ChatNotFound
        }
    } else {
        NotAuthorised
    }
}

async fn mark_read_on_recipients_canister(canister_id: CanisterId, up_to_message_index: MessageIndex) {
    let args = handle_mark_read::Args { up_to_message_index };
    let _ = user_canister_client::handle_mark_read(canister_id, &args).await;
}
