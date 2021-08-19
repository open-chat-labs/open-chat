use self::Response::*;
use crate::domain::chat::{Chat, Message};
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;

pub fn query(chat_id: ChatId, from_id: u32, page_size: u32) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    match chat_list.get(chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => {
            let messages = chat.get_messages(&me, from_id, page_size);
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

#[derive(CandidType)]
pub struct Result {
    messages: Vec<Message>,
    latest_message_id: u32,
}

impl Result {
    pub fn new(messages: Vec<Message>, latest_message_id: u32) -> Result {
        Result {
            messages,
            latest_message_id,
        }
    }
}
