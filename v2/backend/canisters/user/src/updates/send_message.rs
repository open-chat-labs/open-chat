use super::send_message::Response::*;
use crate::model::direct_chat::DirectChat;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::reply_context::ReplyContext;
use shared::types::{chat_id::DirectChatId, MessageId, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};

pub fn update(args: &Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let now = runtime_state.env.now();
        let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &args.recipient));
        let chat: &mut DirectChat = match runtime_state.data.direct_chats.entry(chat_id) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(DirectChat::new(args.recipient, now)),
        };
        let message_id = chat.next_message_id();
        let message = Message {
            id: message_id,
            client_message_id: args.client_message_id,
            timestamp: now,
            sent_by_me: true,
            content: args.content.clone(),
            replies_to: args.replies_to.clone(),
        };
        chat.messages.push(message);

        Success(SuccessResult {
            message_id,
            timestamp: now,
        })
    } else {
        NotAuthorised
    }
}

#[derive(Deserialize)]
pub struct Args {
    pub client_message_id: u128,
    pub recipient: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
pub struct SuccessResult {
    message_id: MessageId,
    timestamp: TimestampMillis,
}
