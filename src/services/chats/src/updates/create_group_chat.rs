use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::timestamp;
use shared::user_id::UserId;
use crate::domain::chat_list::ChatList;
use crate::domain::group_chat::GroupChatSummary;
use self::Response::*;

pub fn update(request: Request) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    match chat_list.create_group_chat(me, request.chat_id, request.subject, request.participants, now) {
        Some(chat_summary) => Success(chat_summary),
        None => ChatAlreadyExists,
    }
}

#[derive(Deserialize)]
pub struct Request {
    chat_id: ChatId,
    subject: String,
    participants: Vec<UserId>
}

#[derive(CandidType)]
pub enum Response {
    Success(GroupChatSummary),
    ChatAlreadyExists,
}
