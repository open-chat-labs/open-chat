use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId};

pub fn update(chat_id: ChatId, up_to_index: u32) -> Option<u32> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let chat = chat_list.get_mut(chat_id, &me)?;

    Some(chat.mark_read(&me, up_to_index))
}