use ic_cdk_macros::*;
use shared::user_id::UserId;
use crate::domain::chat::ChatId;
use crate::queries::*;
use crate::updates::*;

#[update]
fn create_group_chat(participants: Vec<UserId>, subject: String) -> create_group_chat::Response {
    create_group_chat::update(participants, subject)
}

#[update]
fn send_direct_message(recipient: UserId, text: String) -> send_direct_message::Response {
    send_direct_message::update(recipient, text)
}

#[update]
fn send_message(chat_id: ChatId, text: String) -> send_message::Response {
    send_message::update(chat_id, text)
}

#[update]
fn mark_read(chat_id: ChatId, up_to_index: u32) -> mark_read::Response {
    mark_read::update(chat_id, up_to_index)
}

#[update]
fn add_participants(chat_id: ChatId, users: Vec<UserId>) -> add_participants::Response {
    add_participants::update(chat_id, users)
}

#[update]
fn remove_participant(chat_id: ChatId, user: UserId) -> remove_participant::Response {
    remove_participant::update(chat_id, user)
}

#[query]
fn get_chats(unread_only: bool) -> get_chats::Response {
    get_chats::query(unread_only)
}

#[query]
fn get_messages(chat_id: ChatId, from_id: u32, page_size: u32) -> get_messages::Response {
    get_messages::query(chat_id, from_id, page_size)
}

#[query]
fn get_messages_by_id(chat_id: ChatId, ids: Vec<u32>) -> get_messages_by_id::Response {
    get_messages_by_id::query(chat_id, ids)
}
