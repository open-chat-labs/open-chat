use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId, Message};
use shared::user_id::UserId;

pub fn query(user_id: UserId, from_id: u32, page_size: u32) -> Option<Vec<Message>> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chat_id = ChatId::for_direct_chat(&me, &user_id);
    let chat = chat_list.get(chat_id, &me)?;

    Some(chat.get_messages(from_id, page_size))
}