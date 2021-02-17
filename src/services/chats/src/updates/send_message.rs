use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::{timestamp, timestamp::Timestamp};
use crate::domain::chat::{Chat, ChatId, MessageContent, ChatSummary, ReplyContext};
use crate::domain::chat_list::ChatList;
use self::Response::*;

pub fn update(request: Request) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    match chat_list.get_mut(request.chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => {
            let now = timestamp::now();
            let message_id = chat.push_message(&me, request.client_message_id, request.content, request.replies_to, now);
            let chat_summary = chat.to_summary(&me, 0);
            Success(Result::new(chat_summary, message_id, now))
        }
    }
}

#[derive(Deserialize)]
pub struct Request {
    chat_id: ChatId,
    client_message_id: String,
    content: MessageContent,
    replies_to: Option<ReplyContext>
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