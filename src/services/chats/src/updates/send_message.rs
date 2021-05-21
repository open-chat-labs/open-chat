use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::{timestamp, timestamp::Timestamp};
use crate::domain::chat::{Chat, MessageContent, ChatSummary, MessageContentValidationResponse, ReplyContext};
use crate::domain::chat_list::ChatList;
use self::Response::*;

pub fn update(request: Request) -> Response {
    // Validation
    if let Some(response) = validate(&request) {
        return response;
    }

    let chat_list: &mut ChatList = storage::get_mut();
    chat_list.add_message_to_stats(&request.content);

    let me = shared::user_id::get_current();
    let is_blob = request.content.is_blob();
    let message_id;
    let response;
    
    if let Some(chat) = chat_list.get_mut(request.chat_id, &me) {
        let now = timestamp::now();
        message_id = chat.push_message(&me, request.client_message_id, request.content, request.replies_to, now);
        let chat_summary = chat.to_summary(&me, 0);
        response = Success(Result::new(chat_summary, message_id, now));
    } else {
        return ChatNotFound;
    }

    chat_list.push_message(request.chat_id, message_id, is_blob);

    response
}

fn validate(request: &Request) -> Option<Response> {
    if request.client_message_id.len() > 100 {
        return Some(Response::InvalidRequest);
    }
    match request.content.validate() {
        MessageContentValidationResponse::MessageTooLong(max) => return Some(MessageTooLong(max)),
        MessageContentValidationResponse::Invalid => return Some(InvalidRequest),
        MessageContentValidationResponse::Valid => ()
    }
    if let Some(reply) = &request.replies_to {
        match reply.get_content().validate() {
            MessageContentValidationResponse::Valid => (),
            _ => return Some(InvalidRequest)
        }
    }
    None
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
    ChatNotFound,
    MessageTooLong(u32),
    InvalidRequest
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