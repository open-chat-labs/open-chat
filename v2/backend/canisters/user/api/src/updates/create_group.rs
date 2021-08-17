use candid::CandidType;
use serde::Deserialize;
use types::GroupChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    Throttled,
    InternalError,
    NotAuthorised,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub group_chat_id: GroupChatId,
}
