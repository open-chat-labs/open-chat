use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use std::cmp::min;
use types::{CanisterId, ChatId, MessageIndex};
use user_canister::c2c_mark_read;
use user_canister::mark_read::{Response::*, *};

#[update]
fn mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let chat_id = ChatId::from(args.user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let max_message_index = chat.events.latest_message_index();
        let up_to_index = min(args.up_to_message_index, max_message_index);
        if up_to_index <= *chat.latest_read_by_me.value() {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.latest_read_by_me.set_value(up_to_index, now);
            ic_cdk::block_on(mark_read_on_recipients_canister(
                args.user_id.into(),
                args.up_to_message_index,
            ));
            Success
        }
    } else {
        ChatNotFound
    }
}

async fn mark_read_on_recipients_canister(canister_id: CanisterId, up_to_message_index: MessageIndex) {
    let args = c2c_mark_read::Args { up_to_message_index };
    let _ = user_canister_c2c_client::c2c_mark_read(canister_id, &args).await;
}
