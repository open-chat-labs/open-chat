use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotPermissions, UserId};

#[ts_export(group, generate_bot_api_key)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub requested_permissions: BotPermissions,
}

#[ts_export(group, generate_bot_api_key)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    BotNotFound,
    ChatFrozen,
    NotAuthorized,
}

#[ts_export(group, generate_bot_api_key)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub api_key: String,
}
