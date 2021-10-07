use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{ChatId, MessageIndex, UserId};
use user_canister::c2c_mark_read::{Response::*, *};
use utils::range_set::insert_ranges;

#[update]
fn c2c_mark_read(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let their_user_id: UserId = runtime_state.env.caller().into();
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let now = runtime_state.env.now();
        let mut has_changes = false;
        if let Some(max_message_index) = chat.events.latest_message_index() {
            let mut added = insert_ranges(
                &mut chat.read_by_them.value,
                &args.message_index_ranges,
                MessageIndex::default(),
                max_message_index,
            );
            for message_id in args.message_ids.into_iter() {
                if let Some(message_index) = chat.events.get_message_index(message_id) {
                    let as_u32 = message_index.into();
                    if chat.read_by_them.value.insert(as_u32) {
                        added.insert(as_u32);
                    }
                } else {
                    match chat.message_ids_read_but_not_confirmed.entry(message_id) {
                        Occupied(e) => e.into_mut().0.push(false),
                        Vacant(e) => {
                            e.insert((vec![false], now));
                        }
                    };
                }
            }
            has_changes = !added.is_empty();
        }
        if !has_changes {
            SuccessNoChange
        } else {
            chat.read_by_them.timestamp = now;
            Success
        }
    } else {
        ChatNotFound
    }
}
