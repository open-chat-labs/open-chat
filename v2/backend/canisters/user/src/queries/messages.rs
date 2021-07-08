use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use crate::queries::messages::Response::*;
use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::DirectChatId;
use shared::types::{MessageIndex, UserId};

pub fn query(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &args.user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get(&chat_id) {
            let messages = chat.get_messages(args.from_id, args.to_id);
            Success(SuccessResult { messages })
        } else {
            ChatNotFound
        }
    } else {
        NotAuthorised
    }
}

#[derive(Deserialize)]
pub struct Args {
    user_id: UserId,
    from_id: MessageIndex,
    to_id: MessageIndex,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorised,
}

#[derive(CandidType)]
pub struct SuccessResult {
    messages: Vec<Message>,
}
