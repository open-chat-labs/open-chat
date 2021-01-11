use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::{timestamp, timestamp::Timestamp};
use shared::user_id::UserId;
use crate::domain::chat::ChatId;
use crate::domain::chat_list::ChatList;
use self::Response::*;

pub fn update(participants: Vec<UserId>, subject: String) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    match chat_list.create_group_chat(me, participants, subject, now) {
        Some(chat_id) => Success(Result {
            chat_id,
            created: now
        }),
        None => ChatAlreadyExists,
    }
}

#[derive(CandidType)]
pub struct Result {
    chat_id: ChatId,
    created: Timestamp
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
    ChatAlreadyExists,
}