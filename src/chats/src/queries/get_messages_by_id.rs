use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId};
use crate::queries::get_messages::Result;

pub fn query(chat_id: ChatId, ids: Vec<u32>) -> Option<Result> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chat = chat_list.get(chat_id, &me)?;

    let messages = chat.get_messages_by_id(ids);
    let latest_message_id = chat.get_latest_message_id();

    Some(Result::new(messages, latest_message_id))
}
