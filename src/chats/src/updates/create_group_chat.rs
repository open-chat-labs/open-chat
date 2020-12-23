use ic_cdk::storage;
use ic_types::Principal;
use crate::domain::chat::ChatId;
use crate::domain::chat_list::ChatList;

pub fn update(participants: Vec<Principal>, subject: String) -> Option<ChatId> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = ic_cdk::caller();
    let now = crate::get_current_timestamp();

    chat_list.create_group_chat(me, participants, subject, now)
}