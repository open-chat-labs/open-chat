use ic_cdk::storage;
use shared::timestamp;
use crate::domain::chat::{Chat, ChatId};
use crate::domain::chat_list::ChatList;

pub fn update(chat_id: ChatId, text: String) -> Option<u32> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    if let Some(chat) = chat_list.get_mut(chat_id, &me) {
        let now = timestamp::now();
        let message_id = chat.push_message(&me, text, now);
        return Some(message_id);
    }

    None
}