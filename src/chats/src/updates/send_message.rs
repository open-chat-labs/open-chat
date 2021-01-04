use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::{timestamp, timestamp::Timestamp};
use crate::domain::chat::{Chat, ChatId};
use crate::domain::chat_list::ChatList;

pub fn update(chat_id: ChatId, text: String) -> Option<Result> {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let chat = chat_list.get_mut(chat_id, &me)?;
    let now = timestamp::now();
    let message_id = chat.push_message(&me, text, now);

    Some(Result::new(message_id, now))
}

#[derive(CandidType)]
pub struct Result {
    message_id: u32,
    timestamp: Timestamp
}

impl Result {
    pub fn new(message_id: u32, timestamp: Timestamp) -> Result {
        Result {
            message_id,
            timestamp
        }
    }
}