use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AccessTokenType, Chat};

#[ts_export(local_user_index, access_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub token_type: AccessTokenType,
    pub chat: Chat,
}

#[ts_export(local_user_index, access_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
    Error(OCError),
}
