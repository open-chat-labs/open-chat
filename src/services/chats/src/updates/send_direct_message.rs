use ic_cdk::export::Principal;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::{timestamp, timestamp::Timestamp};
use shared::user_id::UserId;
use crate::domain::chat::{Chat, ChatId, MessageContent};
use crate::domain::chat_list::ChatList;
use crate::services::user_mgmt::*;
use self::Response::*;

pub async fn update(recipient: UserId, client_message_id: String, content: MessageContent) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let now = timestamp::now();
    let me = shared::user_id::get_current();
    let chat_id = ChatId::for_direct_chat(&me, &recipient);
    let chat = chat_list.get_mut(chat_id, &me);

    if let MessageContent::Cycle(cycle_content) = content {
        let user_mgmt_id = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        let request = transfer_cycles::Request {
            recipient: recipient,
            amount: cycle_content.get_amount()
        };

        let response: transfer_cycles::Response = ic_cdk::call(
            user_mgmt_id, 
            "transfer_cycles", 
            request).await.unwrap();

        match response {
            transfer_cycles::Response::Success(result) => (),
            transfer_cycles::Response::UserNotFound => return UserNotFound,
            transfer_cycles::Response::RecipientNotFound => return RecipientNotFound,
            transfer_cycles::Response::BalanceExceeded => return BalanceExceeded
        }
    }

    let message_id = match chat {
        Some(c) => c.push_message(&me, client_message_id, content, now),
        None => chat_list.create_direct_chat(chat_id, me, recipient, client_message_id, content, now)
    };

    Success(Result {
        chat_id,
        message_id,
        timestamp: now
    })
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
    chat_id: ChatId,
    message_id: u32,
    timestamp: Timestamp,
}
