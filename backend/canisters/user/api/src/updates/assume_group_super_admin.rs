use candid::CandidType;
use serde::Deserialize;
use types::ChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    NotSuperAdmin,
    AlreadyOwner,
    AlreadySuperAdmin,
    InternalError(String),
}
