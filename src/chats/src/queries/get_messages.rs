use ic_cdk::storage;
use crate::domain::chat::{ChatId, Message};
use crate::domain::chat_list::ChatList;

pub fn query(chat_id: ChatId, from_id: u32) -> Option<Vec<Message>> {
    let chat_list: &ChatList = storage::get();
    let me = ic_cdk::caller();
    let chat = chat_list.get(chat_id, &me)?;

    Some(chat.get_messages(&me, from_id))
}