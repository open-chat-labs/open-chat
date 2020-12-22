use ic_cdk::{api, storage};
use ic_types::Principal;
use crate::domain::direct_chat::ChatId;
use crate::domain::chat_list::ChatList;

pub fn update(recipient: Principal, text: String) -> Option<ChatId> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();
    let timestamp = api::time() as u64;

    chat_list.create(me, recipient, text, timestamp)
}