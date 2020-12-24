use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::ChatSummary;

pub fn query() -> Vec<ChatSummary> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();

    chat_list.list_chats(&me)
}