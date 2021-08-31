use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use std::cmp::min;
use types::{ChatId, UserId};
use user_canister::c2c_mark_read::{Response::*, *};

#[update]
fn c2c_mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let their_user_id: UserId = runtime_state.env.caller().into();
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let max_message_index = chat.events.latest_message_index();
        let up_to_index = min(args.up_to_message_index, max_message_index);
        if up_to_index <= *chat.latest_read_by_them.value() {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.latest_read_by_them.set_value(up_to_index, now);
            Success
        }
    } else {
        ChatNotFound
    }
}
