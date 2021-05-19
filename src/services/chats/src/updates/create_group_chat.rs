use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::timestamp;
use shared::user_id::UserId;
use crate::domain::chat_list::ChatList;
use crate::domain::group_chat::GroupChatSummary;
use self::Response::*;

const MIN_GROUP_SUBJECT_LENGTH: u8 = 2;
const MAX_GROUP_SUBJECT_LENGTH: u8 = 25;
const MAX_NUMBER_GROUP_PARTICPANTS: u8 = 100;

pub fn update(request: Request) -> Response {

    // Validation
    if request.subject.len() < MIN_GROUP_SUBJECT_LENGTH as usize {
        return SubjectTooShort(MIN_GROUP_SUBJECT_LENGTH);
    } else if request.subject.len() > MAX_GROUP_SUBJECT_LENGTH as usize {
        return SubjectTooLong(MAX_GROUP_SUBJECT_LENGTH);
    } else if request.participants.len() > MAX_NUMBER_GROUP_PARTICPANTS as usize {
        return TooManyParticipants(MAX_NUMBER_GROUP_PARTICPANTS);
    }

    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    match chat_list.create_group_chat(me, request.chat_id, request.subject, request.participants, now) {
        Some(chat_summary) => Success(chat_summary),
        None => ChatAlreadyExists,
    }
}

#[derive(Deserialize)]
pub struct Request {
    chat_id: ChatId,
    subject: String,
    participants: Vec<UserId>
}

#[derive(CandidType)]
pub enum Response {
    Success(GroupChatSummary),
    ChatAlreadyExists,
    SubjectTooShort(u8),
    SubjectTooLong(u8),
    TooManyParticipants(u8)
}
