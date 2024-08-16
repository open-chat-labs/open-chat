use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, reported_messages)]
pub struct Args {
    pub user_id: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, reported_messages)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, reported_messages)]
pub struct SuccessResult {
    pub json: String,
}
