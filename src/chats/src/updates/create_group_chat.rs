use ic_cdk::storage;
use shared::timestamp;
use shared::user_id::UserId;
use crate::domain::chat::ChatId;
use crate::domain::chat_list::ChatList;

pub fn update(participants: Vec<UserId>, subject: String) -> Option<ChatId> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    chat_list.create_group_chat(me, participants, subject, now)
}