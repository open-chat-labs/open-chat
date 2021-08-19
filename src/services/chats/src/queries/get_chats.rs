use self::Response::*;
use crate::domain::chat::ChatSummary;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::timestamp::Timestamp;

pub fn query(request: Request) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();

    Success(chat_list.get_summaries(
        &me,
        request.updated_since,
        request.message_count_for_top_chat,
    ))
}

#[derive(Deserialize)]
pub struct Request {
    updated_since: Option<Timestamp>,
    message_count_for_top_chat: Option<u16>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Vec<ChatSummary>),
}
