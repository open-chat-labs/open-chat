use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{ChatId, MessageId, MessageIndex};
use user_canister::c2c_mark_read;
use user_canister::mark_read::{Response::*, *};
use utils::range_set::{convert_to_message_index_ranges, insert_ranges, RangeSet};

#[update]
fn mark_read(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let chat_id = args.user_id.into();
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let now = runtime_state.env.now();
        let mut added = RangeSet::new();
        let mut unrecognised_message_ids = Vec::new();
        if let Some(max_message_index) = chat.events.latest_message_index() {
            added = insert_ranges(
                &mut chat.read_by_me.value,
                &args.message_index_ranges,
                MessageIndex::default(),
                max_message_index,
            );
            for message_id in args.message_ids.into_iter() {
                if let Some(message_index) = chat.events.get_message_index(message_id) {
                    let as_u32 = message_index.into();
                    if chat.read_by_me.value.insert(as_u32) {
                        added.insert(as_u32);
                    }
                } else {
                    unrecognised_message_ids.push(message_id);
                    match chat.message_ids_read_but_not_confirmed.entry(message_id) {
                        Occupied(e) => e.into_mut().0.push(true),
                        Vacant(e) => {
                            e.insert((vec![true], now));
                        }
                    };
                }
            }
        }
        let has_changes = !added.is_empty();

        let mut their_message_ranges = RangeSet::new();
        for index in added.iter().filter_map(|m| chat.unread_message_index_map.get(&m.into())) {
            their_message_ranges.insert(index.into());
        }

        if !their_message_ranges.is_empty() || !unrecognised_message_ids.is_empty() {
            ic_cdk::block_on(mark_read_on_recipients_canister(
                chat_id,
                their_message_ranges,
                added,
                unrecognised_message_ids,
            ));
        }

        if has_changes {
            chat.read_by_me.timestamp = now;
            Success
        } else {
            SuccessNoChange
        }
    } else {
        ChatNotFound
    }
}

async fn mark_read_on_recipients_canister(
    chat_id: ChatId,
    their_message_ranges: RangeSet,
    our_message_ranges: RangeSet,
    message_ids: Vec<MessageId>,
) {
    let args = c2c_mark_read::Args {
        message_index_ranges: convert_to_message_index_ranges(their_message_ranges),
        message_ids,
    };
    let _ = user_canister_c2c_client::c2c_mark_read(chat_id.into(), &args).await;

    RUNTIME_STATE
        .with(|state| remove_from_message_index_map(chat_id, our_message_ranges, state.borrow_mut().as_mut().unwrap()));

    fn remove_from_message_index_map(chat_id: ChatId, ranges: RangeSet, runtime_state: &mut RuntimeState) {
        if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
            for message_index in ranges.iter() {
                chat.unread_message_index_map.remove(&message_index.into());
            }
        }
    }
}
