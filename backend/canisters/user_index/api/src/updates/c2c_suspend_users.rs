use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
    pub duration: Option<Milliseconds>,
    pub reason: String,
    pub suspended_by: UserId,
}

pub type Response = SuccessOnly;
