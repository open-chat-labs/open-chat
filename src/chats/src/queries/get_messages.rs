use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::{Chat, ChatId, Message};

pub fn query(chat_id: ChatId, from_id: u32, page_size: u32) -> Option<Result> {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chat = chat_list.get(chat_id, &me)?;

    let messages = chat.get_messages(from_id, page_size);
    let latest_message_id = chat.get_latest_message_id();

    Some(Result::new(messages, latest_message_id))
}

#[derive(CandidType)]
pub struct Result {
    messages: Vec<Message>,
    latest_message_id: u32
}

impl Result {
    pub fn new(messages: Vec<Message>, latest_message_id: u32) -> Result {
        Result {
            messages,
            latest_message_id
        }
    }
}