use ic_cdk_macros::*;
use shared::chat_id::ChatId;
use shared::user_id::UserId;
use crate::queries::*;
use crate::updates::*;

#[update]
fn create_group_chat(request: create_group_chat::Request) -> create_group_chat::Response {
    create_group_chat::update(request)
}

#[update]
async fn send_direct_message(request: send_direct_message::Request) -> send_direct_message::Response {
    send_direct_message::update(request).await
}

#[update]
fn send_message(request: send_message::Request) -> send_message::Response {
    send_message::update(request)
}

#[update]
fn mark_read(chat_id: ChatId, from_id: u32, to_id: u32) -> mark_read::Response {
    mark_read::update(chat_id, from_id, to_id)
}

#[update]
fn add_participants(chat_id: ChatId, users: Vec<UserId>) -> add_participants::Response {
    add_participants::update(chat_id, users)
}

#[update]
fn remove_participant(chat_id: ChatId, user: UserId) -> remove_participant::Response {
    remove_participant::update(chat_id, user)
}

#[update]
fn leave_group(chat_id: ChatId) -> leave_group::Response {
    leave_group::update(chat_id)
}

#[update]
fn delete_group(chat_id: ChatId) -> delete_group::Response {
    delete_group::update(chat_id)
}

#[update]
fn put_chunk(blob_id: String, chunk_index: u32, data: Vec<u8>) -> bool {
    put_chunk::update(blob_id, chunk_index, data);
    true
}

#[query]
fn get_chats(request: get_chats::Request) -> get_chats::Response {
    get_chats::query(request)
}

#[query]
fn get_messages(chat_id: ChatId, from_id: u32, page_size: u32) -> get_messages::Response {
    get_messages::query(chat_id, from_id, page_size)
}

#[query]
fn get_messages_by_id(chat_id: ChatId, ids: Vec<u32>) -> get_messages_by_id::Response {
    get_messages_by_id::query(chat_id, ids)
}

#[query]
fn get_chunk(blob_id: String, chunk_index: u32) -> Option<Vec<u8>> {
    get_chunk::query(blob_id, chunk_index)
}

#[query]
fn search_all_messages(search_term: String, max_results: u8) -> search_all_messages::Response {
    search_all_messages::query(&search_term, max_results)
}
