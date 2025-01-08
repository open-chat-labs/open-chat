use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::types::{MessageContent, MessageId};

#[allow(clippy::large_enum_variant)]
#[derive(Serialize)]
pub enum ExecuteCommandResponse {
    Success(SuccessResult),
    BadRequest(BadRequest),
    InternalError(InternalError),
}

#[derive(Serialize)]
pub struct SuccessResult {
    pub message: Option<Message>,
}

#[derive(Serialize)]
pub struct Message {
    pub id: MessageId,
    pub content: MessageContent,
    pub finalised: bool,
}

#[derive(Serialize)]
pub enum BadRequest {
    AccessTokenNotFound,
    AccessTokenInvalid,
    AccessTokenExpired,
    CommandNotFound,
    ArgsInvalid,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum InternalError {
    Invalid(String),
    CanisterError(CanisterError),
    C2CError(i32, String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CanisterError {
    NotAuthorized,
    Frozen,
    Other(String),
}
