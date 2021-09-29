use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::{ChatId, MessageIndex};
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
        let mut added = RangeSet::new();
        if let Some(max_message_index) = chat.events.latest_message_index() {
            added = insert_ranges(
                &mut chat.read_by_me,
                &args.message_ranges,
                MessageIndex::default(),
                max_message_index,
            );
        }
        if added.is_empty() {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.read_by_me_updated = now;

            let mut their_message_ranges = RangeSet::new();
            for index in added.iter().filter_map(|m| chat.unread_message_index_map.get(&m.into())) {
                their_message_ranges.insert(index.into());
            }

            if !their_message_ranges.is_empty() {
                ic_cdk::block_on(mark_read_on_recipients_canister(chat_id, their_message_ranges, added));
            }

            Success
        }
    } else {
        ChatNotFound
    }
}

async fn mark_read_on_recipients_canister(chat_id: ChatId, their_message_ranges: RangeSet, our_message_ranges: RangeSet) {
    let args = c2c_mark_read::Args {
        message_ranges: convert_to_message_index_ranges(their_message_ranges),
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
