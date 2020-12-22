use ic_cdk::{api, storage};
use crate::domain::chat::ChatId;
use crate::domain::chat_list::ChatList;

pub fn update(chat_id: ChatId, text: String) -> Option<u64> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    if let Some(chat) = chat_list.get_mut(chat_id, &me) {
        let timestamp = api::time() as u64;
        let message_id = chat.push_message(&me, text, timestamp);
        return Some(message_id);
    }

    None
}