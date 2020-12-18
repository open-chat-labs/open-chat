use ic_cdk::{api, storage};
use ic_types::Principal;
use crate::domain::chat_list::ChatList;

pub fn update(recipient: Principal, text: String) {
    let me = ic_cdk::caller();

    let chat_list: &mut ChatList = storage::get_mut();

    let chat = chat_list.get_or_add_chat(me.clone(), recipient);

    let timestamp = api::time() as u64;

    chat.push_message(&me, text, timestamp);
}