use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::{timestamp, timestamp::Timestamp};
use crate::domain::chat::{Chat, MessageContent, ChatSummary, ChatEnum, MessageContentValidationResponse, ReplyContext};
use crate::domain::chat_list::ChatList;
use crate::domain::blocked_users::{BlockedUsers, BlockedStatus};
use self::Response::*;

pub fn update(request: Request) -> Response {
    // Validation
    if let Some(response) = validate(&request) {
        return response;
    }

    let me = shared::user_id::get_current();
    let chat_list: &mut ChatList = storage::get_mut();    
    
    {
        // Try to find the requested chat
        let chat = chat_list.get(request.chat_id, &me);

        if chat.is_none() {
            return ChatNotFound;
        }

        // Check whether either user blocks the other
        if let ChatEnum::Direct(dc) = chat.unwrap() {
            let blocked_users: &mut BlockedUsers = storage::get_mut();
            let blocked_status = blocked_users.blocked_status(&me, dc.get_other(&me));
            match blocked_status {
                BlockedStatus::Sender => return SenderBlocked,
                BlockedStatus::Recipient => return RecipientBlocked,
                BlockedStatus::Both => return RecipientBlocked,
                BlockedStatus::Unblocked => ()
            };
        }
    }

    {
        let now = timestamp::now();

        let message_id = chat_list.push_message(
            request.chat_id, 
            &me, 
            request.client_message_id, 
            request.content, 
            request.replies_to, 
            now).unwrap();

        let chat = chat_list.get(request.chat_id, &me).unwrap();
        let chat_summary = chat.to_summary(&me, 0);
        Success(Result::new(chat_summary, message_id, now))
    }
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
    InvalidRequest,
    SenderBlocked,
    RecipientBlocked
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