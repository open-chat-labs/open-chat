use crate::domain::chat::Chat;
use crate::domain::chat_list::ChatList;
use ic_cdk::storage;
use shared::chat_id::ChatId;

pub fn update(chat_id: ChatId, mute: bool) {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();

    if let Some(chat) = chat_list.get_mut(chat_id, &me) {
        chat.mute_notifications(me, mute);
    }
}
