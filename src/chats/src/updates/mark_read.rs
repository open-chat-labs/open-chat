use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId, MarkReadResult};
use self::Response::*;

pub fn update(chat_id: ChatId, up_to_index: u32) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    match chat_list.get_mut(chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => Success(chat.mark_read(&me, up_to_index))
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(MarkReadResult),
    ChatNotFound
}

