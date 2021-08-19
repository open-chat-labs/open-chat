use self::Response::*;
use crate::domain::chat_list::ChatList;
use crate::domain::group_chat::GroupChatSummary;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::timestamp;
use shared::user_id::UserId;

const MIN_GROUP_SUBJECT_LENGTH: u8 = 2;
const MAX_GROUP_SUBJECT_LENGTH: u8 = 25;

pub fn update(request: Request) -> Response {
    // Validation
    if request.subject.len() < MIN_GROUP_SUBJECT_LENGTH as usize {
        return SubjectTooShort(MIN_GROUP_SUBJECT_LENGTH);
    } else if request.subject.len() > MAX_GROUP_SUBJECT_LENGTH as usize {
        return SubjectTooLong(MAX_GROUP_SUBJECT_LENGTH);
    }

    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let chat_summary = chat_list.create_group_chat(
        me,
        request.chat_id,
        request.subject,
        request.participants,
        request.chat_history_visible_to_new_joiners,
        now,
    );

    match chat_summary {
        Some(cs) => Success(cs),
        None => ChatAlreadyExists,
    }
}

#[derive(Deserialize)]
pub struct Request {
    chat_id: ChatId,
    subject: String,
    participants: Vec<UserId>,
    chat_history_visible_to_new_joiners: bool,
}

#[derive(CandidType)]
pub enum Response {
    Success(GroupChatSummary),
    ChatAlreadyExists,
    SubjectTooShort(u8),
    SubjectTooLong(u8),
}
