use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, MessageIndex, MessageIndexRange};
use user_canister::c2c_mark_read;
use user_canister::mark_read::{Response::*, *};
use utils::range_set::insert_ranges;

#[update]
fn mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let chat_id = ChatId::from(args.user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let mut has_changes = false;
        if let Some(max_message_index) = chat.events.latest_message_index() {
            has_changes = insert_ranges(
                &mut chat.read_by_me,
                &args.message_ranges,
                MessageIndex::default(),
                max_message_index,
            );
        }
        if !has_changes {
            SuccessNoChange
        } else {
            let now = runtime_state.env.now();
            chat.read_by_me_updated = now;
            ic_cdk::block_on(mark_read_on_recipients_canister(args.user_id.into(), args.message_ranges));
            Success
        }
    } else {
        ChatNotFound
    }
}

async fn mark_read_on_recipients_canister(canister_id: CanisterId, message_ranges: Vec<MessageIndexRange>) {
    let args = c2c_mark_read::Args { message_ranges };
    let _ = user_canister_c2c_client::c2c_mark_read(canister_id, &args).await;
}
