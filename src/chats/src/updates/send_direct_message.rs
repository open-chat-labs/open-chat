use ic_cdk::storage;
use shared::timestamp;
use shared::user_id::UserId;
use crate::domain::chat::{Chat, ChatId};
use crate::domain::chat_list::ChatList;
use crate::updates::send_message::SendMessageResult;

pub fn update(recipient: UserId, text: String) -> SendMessageResult {
    let chat_list: &mut ChatList = storage::get_mut();
    let now = timestamp::now();
    let me = shared::user_id::get_current();
    let chat_id = ChatId::for_direct_chat(&me, &recipient);
    let chat = chat_list.get_mut(chat_id, &me);

    let message_id = match chat {
        Some(c) => c.push_message(&me, text, now),
        None => chat_list.create_direct_chat(chat_id, me, recipient, text, now)
    };

    SendMessageResult::new(message_id, now)
}