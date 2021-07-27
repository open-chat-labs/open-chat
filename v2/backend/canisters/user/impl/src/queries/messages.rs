use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use shared::types::chat_id::DirectChatId;
use user_canister::queries::messages::{Response::*, *};

#[query]
fn messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let my_user_id = runtime_state.env.canister_id().into();
        let their_user_id = args.user_id;
        let chat_id = DirectChatId::from((&my_user_id, &their_user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get(&chat_id) {
            let messages = chat
                .messages
                .get_range(args.from_index, args.to_index)
                .into_iter()
                .map(|m| chat.messages.hydrate_message(m))
                .collect();

            Success(SuccessResult { messages })
        } else {
            ChatNotFound
        }
    } else {
        NotAuthorised
    }
}
