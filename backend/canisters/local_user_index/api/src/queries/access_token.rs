use candid::CandidType;
use ts_export::ts_export;
use types::{AccessTokenType, Chat};

#[ts_export(local_user_index, access_token)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub token_type: AccessTokenType,
    pub chat: Chat,
}

#[ts_export(local_user_index, access_token)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
}
