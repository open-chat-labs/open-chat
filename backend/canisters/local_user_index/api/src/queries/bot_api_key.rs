use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(local_user_index, bot_api_key)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub jwt: String,
}

#[ts_export(local_user_index, bot_api_key)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    FailedAuthentication(String),
    NotAuthorized,
    C2CError(i32, String),
}
