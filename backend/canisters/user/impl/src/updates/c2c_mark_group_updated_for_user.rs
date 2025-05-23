use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::ChatId;
use user_canister::c2c_mark_group_updated_for_user::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn c2c_mark_group_updated_for_user(_args: Args) -> Response {
    execute_update(c2c_mark_group_updated_for_user_impl)
}

fn c2c_mark_group_updated_for_user_impl(state: &mut RuntimeState) -> Response {
    let chat_id: ChatId = state.env.caller().into();
    if let Some(chat) = state.data.group_chats.get_mut(&chat_id) {
        let now = state.env.now();
        chat.last_changed_for_my_data = now;
    }
    Success
}
