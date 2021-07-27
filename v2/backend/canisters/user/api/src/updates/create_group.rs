use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    Throttled,
    InternalError,
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub group_chat_id: GroupChatId,
}
