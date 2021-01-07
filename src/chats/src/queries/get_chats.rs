use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::ChatSummary;
use self::Response::*;

pub fn query(unread_only: bool) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();

    Success(chat_list.get_chats(&me, unread_only))
}

#[derive(CandidType)]
pub enum Response {
    Success(Vec<ChatSummary>)
}
