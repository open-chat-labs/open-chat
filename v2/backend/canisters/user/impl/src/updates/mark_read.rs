use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use range_set::RangeSet;
use types::{ChatId, MessageIndex, MessageIndexRange};
use user_canister::c2c_mark_read;
use user_canister::mark_read::{Response::*, *};
use utils::range_set::{convert_to_message_index_ranges, insert_ranges_and_return_added};

#[update]
fn mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let chat_id = args.user_id.into();
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let mut newly_read_messages = Vec::new();
        if let Some(max_message_index) = chat.events.latest_message_index() {
            newly_read_messages = insert_ranges_and_return_added(
                &mut chat.read_by_me,
                &args.message_ranges,
                MessageIndex::default(),
                max_message_index,
            );
        }
        if newly_read_messages.is_empty() {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.read_by_me_updated = now;

            let mut their_message_ranges = RangeSet::new();
            for index in newly_read_messages
                .iter()
                .filter_map(|m| chat.unread_message_index_map.get(m))
            {
                their_message_ranges.insert(index.into());
            }

            if !their_message_ranges.is_empty() {
                ic_cdk::block_on(mark_read_on_recipients_canister(
                    chat_id,
                    convert_to_message_index_ranges(their_message_ranges),
                    newly_read_messages,
                ));
            }

            Success
        }
    } else {
        ChatNotFound
    }
}

async fn mark_read_on_recipients_canister(
    chat_id: ChatId,
    their_message_ranges: Vec<MessageIndexRange>,
    our_message_indexes: Vec<MessageIndex>,
) {
    let args = c2c_mark_read::Args {
        message_ranges: their_message_ranges,
    };
    let _ = user_canister_c2c_client::c2c_mark_read(chat_id.into(), &args).await;

    RUNTIME_STATE
        .with(|state| remove_from_message_index_map(chat_id, our_message_indexes, state.borrow_mut().as_mut().unwrap()));

    fn remove_from_message_index_map(chat_id: ChatId, messages: Vec<MessageIndex>, runtime_state: &mut RuntimeState) {
        if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
            for message_index in messages.iter() {
                chat.unread_message_index_map.remove(message_index);
            }
        }
    }
}
