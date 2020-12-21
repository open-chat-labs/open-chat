use ic_types::Principal;
use crate::domain::chat_list::{ChatId, ChatList};
use ic_cdk::{storage};

pub fn update(recipient: Principal) -> Option<ChatId> {

    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();

    chat_list.create(me, recipient)
}