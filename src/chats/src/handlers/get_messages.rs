use ic_cdk::storage;
use ic_types::Principal;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::Message;

pub fn query(from_user: Principal, from_index: usize) -> Vec<Message> {
    let me = ic_cdk::caller();

    let chat_list: &mut ChatList = storage::get_mut();

    match chat_list.get(from_user, me.clone()) {
        Some(c) => c.get_messages(&me, from_index),
        None => Vec::new()
    }
}