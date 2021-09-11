use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::ChatId;
use user_canister::events_by_index::{Response::*, *};

#[query]
fn events_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let their_user_id = args.user_id;
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get(&chat_id) {
        let events = chat.events.get_by_index(args.events);
        Success(SuccessResult { events })
    } else {
        ChatNotFound
    }
}
