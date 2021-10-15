use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use types::ChatId;
use user_canister::c2c_mark_read;
use user_canister::mark_read::{Response::*, *};
use utils::range_set::{convert_to_message_index_ranges, insert_ranges, RangeSet};

#[update]
#[instrument(level = "trace")]
fn mark_read(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();

    for chat_messages_read in args.messages_read {
        if let Some(group_chat) = runtime_state.data.group_chats.get_mut(&chat_messages_read.chat_id) {
            let added = insert_ranges(&mut group_chat.read_by_me.value, &chat_messages_read.message_ranges);
            if !added.is_empty() {
                group_chat.read_by_me.timestamp = now;
            }
        } else if let Some(direct_chat) = runtime_state.data.direct_chats.get_mut(&chat_messages_read.chat_id) {
            let added = insert_ranges(&mut direct_chat.read_by_me.value, &chat_messages_read.message_ranges);
            if !added.is_empty() {
                direct_chat.read_by_me.timestamp = now;

                let mut their_message_ranges = RangeSet::new();
                for index in added
                    .iter()
                    .filter_map(|m| direct_chat.unread_message_index_map.get(&m.into()))
                {
                    their_message_ranges.insert(index.into());
                }

                if !their_message_ranges.is_empty() {
                    ic_cdk::block_on(mark_read_on_recipients_canister(
                        chat_messages_read.chat_id,
                        their_message_ranges,
                        added,
                    ));
                }
            }
        }
    }

    Success
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
