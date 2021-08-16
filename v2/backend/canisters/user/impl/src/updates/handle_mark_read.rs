use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::DirectChatId;
use user_canister::updates::handle_mark_read::{Response::*, *};

#[update]
fn handle_mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| handle_mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn handle_mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let their_user_id = runtime_state.env.caller().into();

    let chat_id = DirectChatId::from((&runtime_state.env.canister_id().into(), &their_user_id));
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        if chat.latest_read_by_them < args.up_to_message_index {
            chat.latest_read_by_them = args.up_to_message_index;
            Success
        } else {
            SuccessNoChange
        }
    } else {
        ChatNotFound
    }
}
