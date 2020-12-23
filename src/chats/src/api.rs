use ic_cdk_macros::*;
use ic_types::Principal;
use crate::domain::chat::{ChatId, ChatSummary, Message};
use crate::queries::*;
use crate::updates::*;

#[update]
fn create_direct_chat(recipient: Principal, text: String) -> Option<ChatId> {
    create_direct_chat::update(recipient, text)
}

#[update]
fn create_group_chat(participants: Vec<Principal>, subject: String) -> Option<ChatId> {
    create_group_chat::update(participants, subject)
}

#[update]
fn send_message(chat_id: ChatId, text: String) -> Option<u32> {
    send_message::update(chat_id, text)
}

#[update]
fn mark_read(chat_id: ChatId, up_to_index: u32) -> Option<u32> {
    mark_read::update(chat_id, up_to_index)
}

#[query]
fn list_chats() -> Vec<ChatSummary> {
    list_chats::query()
}

#[query]
fn get_messages(chat_id: ChatId, from_id: u32) -> Option<Vec<Message>> {
    get_messages::query(chat_id, from_id)
}

