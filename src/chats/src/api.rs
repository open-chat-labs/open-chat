use ic_cdk_macros::*;
use shared::user_id::UserId;
use crate::domain::chat::{ChatId, ChatSummary, Message};
use crate::queries::*;
use crate::updates::*;

#[update]
fn create_direct_chat(recipient: UserId, text: String) -> Option<ChatId> {
    create_direct_chat::update(recipient, text)
}

#[update]
fn create_group_chat(participants: Vec<UserId>, subject: String) -> Option<ChatId> {
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

#[update]
fn add_participants(chat_id: ChatId, users: Vec<UserId>) -> add_participants::AddParticipantsResult {
    add_participants::update(chat_id, users)
}

#[update]
fn remove_participant(chat_id: ChatId, user: UserId) -> remove_participant::RemoveParticipantResult {
    remove_participant::update(chat_id, user)
}

#[query]
fn list_chats(unread_only: bool) -> Vec<ChatSummary> {
    list_chats::query(unread_only)
}

#[query]
fn get_messages(chat_id: ChatId, from_id: u32, to_id: u32) -> Option<Vec<Message>> {
    get_messages::query(chat_id, from_id, to_id)
}

