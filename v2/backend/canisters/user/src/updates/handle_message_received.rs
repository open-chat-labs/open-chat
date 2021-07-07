use super::handle_message_received::Response::*;
use crate::model::direct_chat::DirectChat;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use serde::Deserialize;
use shared::types::message_content::MessageContent;
use shared::types::reply_context::ReplyContext;
use shared::types::{CanisterId, ChatId};
use std::collections::hash_map::Entry::{Occupied, Vacant};

pub async fn call_c2c(canister_id: CanisterId, args: Args) -> Result<Response, String> {
    let (res,): (Response,) = ic_cdk::call(canister_id, "handle_message_received", (args,))
        .await
        .map_err(|e| e.1)?;

    Ok(res)
}

pub fn update(args: Args, runtime_state: &mut RuntimeState) -> Response {
    // TODO validate that this request came from an OpenChat canister
    let sender_user_id = runtime_state.env.caller().into();

    let now = runtime_state.env.now();
    let chat_id = ChatId::from((&runtime_state.env.owner_user_id(), &sender_user_id));
    let chat: &mut DirectChat = match runtime_state.data.direct_chats.entry(chat_id) {
        Occupied(e) => e.into_mut(),
        Vacant(e) => e.insert(DirectChat::new(sender_user_id, now)),
    };
    let message_id = chat.next_message_id();
    let message = Message {
        id: message_id,
        client_message_id: args.client_message_id,
        timestamp: now,
        sent_by_me: false,
        content: args.content,
        replies_to: args.replies_to,
    };
    chat.messages.push(message);

    Success
}

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub client_message_id: u128,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
