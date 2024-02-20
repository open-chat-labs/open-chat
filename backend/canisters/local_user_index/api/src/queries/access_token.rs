use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessTokenType, Chat};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub token_type: AccessTokenType,
    pub chat: Chat,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
}
