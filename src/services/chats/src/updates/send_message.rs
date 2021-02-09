use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::{timestamp, timestamp::Timestamp};
use crate::domain::chat::{Chat, ChatId, MessageContent, ChatSummary};
use crate::domain::chat_list::ChatList;
use self::Response::*;

pub fn update(chat_id: ChatId, client_message_id: String, content: MessageContent) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    match chat_list.get_mut(chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => {
            let now = timestamp::now();
            let message_id = chat.push_message(&me, client_message_id, content, now);
            let chat_summary = chat.to_summary(&me, 0);
            Success(Result::new(chat_summary, message_id, now))
        }
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
    ChatNotFound
}

#[derive(CandidType)]
pub struct Result {
    chat_summary: ChatSummary,
    message_id: u32,
    timestamp: Timestamp
}

impl Result {
    pub fn new(chat_summary: ChatSummary, message_id: u32, timestamp: Timestamp) -> Result {
        Result {
            chat_summary,
            message_id,
            timestamp
        }
    }
}