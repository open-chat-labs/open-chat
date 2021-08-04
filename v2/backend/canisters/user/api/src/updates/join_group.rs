use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub group_chat_id: GroupChatId,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    AlreadyInGroup,
    GroupNotFound,
    GroupNotPublic,
    Blocked,
    NotAuthorized,
    InternalError(String),
}
