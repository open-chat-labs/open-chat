use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, suspected_bots)]
pub struct Args {
    #[ts(optional)]
    pub after: Option<UserId>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, suspected_bots)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, suspected_bots)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
