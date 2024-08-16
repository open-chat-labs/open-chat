use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, platform_moderators)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, platform_moderators)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
