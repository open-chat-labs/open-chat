use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::timestamp::{self, Timestamp};
use shared::user_id::UserId;
use crate::domain::chat::{Chat, ChatEnum, ChatId, MessageContent, ReplyContext};
use crate::domain::chat_list::ChatList;
use crate::domain::direct_chat::DirectChatSummary;
use crate::services::user_mgmt::*;
use self::Response::*;

pub async fn update(request: Request) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let now = timestamp::now();
    let me = shared::user_id::get_current();
    let chat_id = ChatId::for_direct_chat(&me, &request.recipient);
    let chat = chat_list.get_mut(chat_id, &me);

    if let MessageContent::Cycles(cycle_content) = &request.content {

        let request = transfer_cycles::Request {
            sender: me.clone(),
            recipient: request.recipient.clone(),
            amount: cycle_content.get_amount()
        };

        let response = transfer_cycles::update(request).await;

        match response {
            transfer_cycles::Response::Success(_) => (),
            transfer_cycles::Response::UserNotFound => return UserNotFound,
            transfer_cycles::Response::RecipientNotFound => return RecipientNotFound,
            transfer_cycles::Response::BalanceExceeded => return BalanceExceeded
        }
    }

    let chat_summary: DirectChatSummary;
    let message_id: u32;
    match chat {
        Some(ChatEnum::Direct(c)) => {
            message_id = c.push_message(
                &me,
                request.client_message_id,
                request.content,
                request.replies_to,
                now);

            chat_summary = DirectChatSummary::new(c, &me, 0);
        },
        _ => {
            message_id = 1;
            chat_summary = chat_list.create_direct_chat(
                chat_id,
                me,
                request.recipient,
                request.client_message_id,
                request.content,
                request.replies_to,
                now);
        }
    };

    Success(Result {
        chat_summary,
        message_id,
        timestamp: now
    })
}

#[derive(Deserialize)]
pub struct Request {
    recipient: UserId,
    client_message_id: String,
    content: MessageContent,
    replies_to: Option<ReplyContext>
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
    UserNotFound,
    RecipientNotFound,
    BalanceExceeded
}

#[derive(CandidType)]
pub struct Result {
    chat_summary: DirectChatSummary,
    message_id: u32,
    timestamp: Timestamp,
}
