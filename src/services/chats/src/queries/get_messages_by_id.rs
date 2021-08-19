use self::Response::*;
use crate::domain::chat::Chat;
use crate::domain::chat_list::ChatList;
use crate::queries::get_messages::Result;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;

pub fn query(chat_id: ChatId, ids: Vec<u32>) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    match chat_list.get(chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => {
            let messages = chat.get_messages_by_id(&me, ids);
            let latest_message_id = chat.get_latest_message_id();
            Success(Result::new(messages, latest_message_id))
        }
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
    ChatNotFound,
}
