use self::Response::*;
use crate::domain::blocked_users::BlockedUsers;
use crate::domain::chat::ChatSummary;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;

pub fn query(request: Request) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();

    let chats = chat_list.get_summaries(
        &me,
        request.updated_since,
        request.message_count_for_top_chat,
    );

    let blocked_users: &BlockedUsers = storage::get();
    let my_blocked_users = blocked_users.get(&me);

    Success(Result::new(chats, my_blocked_users))
}

#[derive(Deserialize)]
pub struct Request {
    updated_since: Option<Timestamp>,
    message_count_for_top_chat: Option<u16>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    chats: Vec<ChatSummary>,
    blocked_users: Vec<UserId>,
}

impl Result {
    pub fn new(chats: Vec<ChatSummary>, blocked_users: Vec<UserId>) -> Result {
        Result {
            chats,
            blocked_users,
        }
    }
}
