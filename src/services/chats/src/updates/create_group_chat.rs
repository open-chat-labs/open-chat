use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::timestamp;
use shared::user_id::UserId;
use crate::domain::chat_list::ChatList;
use crate::domain::group_chat::GroupChatSummary;
use self::Response::*;

pub fn update(participants: Vec<UserId>, subject: String) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    match chat_list.create_group_chat(me, participants, subject, now) {
        Some(chat_summary) => Success(chat_summary),
        None => ChatAlreadyExists,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(GroupChatSummary),
    ChatAlreadyExists,
}
