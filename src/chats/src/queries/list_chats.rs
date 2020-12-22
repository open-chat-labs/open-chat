use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::direct_chat::ChatSummary;

pub fn query() -> Vec<ChatSummary> {
    let chat_list: &ChatList = storage::get();
    let me = ic_cdk::caller();

    chat_list.list_chats(&me)
}