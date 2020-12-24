use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId, Message};

pub fn query(chat_id: ChatId, from_id: u32) -> Option<Vec<Message>> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chat = chat_list.get(chat_id, &me)?;

    Some(chat.get_messages(from_id))
}