use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(user_index, platform_operators)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, platform_operators)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
