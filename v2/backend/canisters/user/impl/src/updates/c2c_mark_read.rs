use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{ChatId, MessageIndex, UserId};
use user_canister::c2c_mark_read::{Response::*, *};
use utils::range_set::insert_ranges;

#[update]
fn c2c_mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let their_user_id: UserId = runtime_state.env.caller().into();
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let min_message_index = MessageIndex::default();
        let max_message_index = chat.events.latest_message_index();
        let has_changes = insert_ranges(
            &mut chat.read_by_them,
            &args.message_ranges,
            min_message_index,
            max_message_index,
        );
        if !has_changes {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.read_by_me_updated = now;
            Success
        }
    } else {
        ChatNotFound
    }
}
