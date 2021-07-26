use crate::canister::RUNTIME_STATE;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use crate::queries::messages_by_index::Response::*;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::chat_id::DirectChatId;
use shared::types::{MessageIndex, UserId};

#[derive(Deserialize)]
struct Args {
    user_id: UserId,
    messages: Vec<MessageIndex>,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorised,
}

#[derive(CandidType)]
struct SuccessResult {
    messages: Vec<Message>,
}

#[query]
fn messages_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| messages_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn messages_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let my_user_id = runtime_state.env.canister_id().into();
        let their_user_id = args.user_id;
        let chat_id = DirectChatId::from((&my_user_id, &their_user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get(&chat_id) {
            let messages = chat
                .messages
                .get_by_index(args.messages)
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
