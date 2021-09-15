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
        let mut has_changes = false;
        if let Some(max_message_index) = chat.events.latest_message_index() {
            let added = insert_ranges(
                &mut chat.read_by_them,
                &args.message_ranges,
                MessageIndex::default(),
                max_message_index,
            );
            has_changes = !added.is_empty();
        }
        if !has_changes {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.read_by_them_updated = now;
            Success
        }
    } else {
        ChatNotFound
    }
}
