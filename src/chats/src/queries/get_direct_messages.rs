use ic_cdk::storage;
use shared::user_id::UserId;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId};
use super::get_messages::Result;

pub fn query(user_id: UserId, from_id: u32, page_size: u32) -> Option<Result> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chat_id = ChatId::for_direct_chat(&me, &user_id);
    let chat = chat_list.get(chat_id, &me)?;

    let messages = chat.get_messages(from_id, page_size);
    let latest_message_id = chat.get_latest_message_id();

    Some(Result::new(messages, latest_message_id))
}