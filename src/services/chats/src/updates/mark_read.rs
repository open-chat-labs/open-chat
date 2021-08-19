use self::Response::*;
use crate::domain::chat::{Chat, MarkReadResult};
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;
use shared::timestamp;

pub fn update(chat_id: ChatId, from_id: u32, to_id: u32) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    match chat_list.get_mut(chat_id, &me) {
        None => ChatNotFound,
        Some(chat) => Success(chat.mark_read(&me, from_id, to_id, now)),
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(MarkReadResult),
    ChatNotFound,
}
