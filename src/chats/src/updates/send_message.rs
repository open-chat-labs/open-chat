use crate::domain::chat_list::{ChatId, ChatList};
use ic_cdk::{api, storage};

pub fn update(chat_id: ChatId, text: String) -> bool {

    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    if let Some(chat) = chat_list.get_mut(chat_id, &me) {
        let timestamp = api::time() as u64;
        chat.push_message(&me, text, timestamp);    
        return true;
    }

    false
}