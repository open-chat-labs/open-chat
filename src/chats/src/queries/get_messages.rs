use ic_cdk::storage;
use crate::domain::chat_list::{ChatId, ChatList};
use crate::domain::chat::Message;

pub fn query(chat_id: ChatId, from_index: usize) -> Option<Vec<Message>> {

    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    let chat = chat_list.get(chat_id, &me)?;

    Some(chat.get_messages(&me, from_index))
}