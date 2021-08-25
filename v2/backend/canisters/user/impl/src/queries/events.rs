use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::DirectChatId;
use user_canister::events::{Response::*, *};

#[query]
fn events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let my_user_id = runtime_state.env.canister_id().into();
        let their_user_id = args.user_id;
        let chat_id = DirectChatId::from((&my_user_id, &their_user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get(&chat_id) {
            let events = chat.events.get_range(args.from_index, args.to_index);
            Success(SuccessResult { events })
        } else {
            ChatNotFound
        }
    } else {
        NotAuthorized
    }
}
