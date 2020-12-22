use ic_cdk::{api, storage};
use crate::domain::direct_chat::ChatId;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::Chat;

pub fn update(chat_id: ChatId, text: String) -> Option<u32> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    if let Some(chat) = chat_list.get_mut(chat_id, &me) {
        let timestamp = api::time() as u64;
        let message_id = chat.push_message(&me, text, timestamp);
        return Some(message_id);
    }

    None
}