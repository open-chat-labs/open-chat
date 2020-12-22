use ic_cdk_macros::*;
use ic_types::Principal;
use crate::domain::chat::{ChatId, ChatSummary, Message};
use crate::queries::*;
use crate::updates::*;

#[query]
fn list_chats() -> Vec<ChatSummary> {
    list_chats::query()
}

#[query]
fn get_messages(chat_id: ChatId, from_index: usize) -> Option<Vec<Message>> {
    get_messages::query(chat_id, from_index)
}

#[update]
fn create_chat(recipient: Principal, text: String) -> Option<ChatId> {
    create_chat::update(recipient, text)
}

#[update]
fn send_message(chat_id: ChatId, text: String) -> Option<u64> {
    send_message::update(chat_id, text)
}

