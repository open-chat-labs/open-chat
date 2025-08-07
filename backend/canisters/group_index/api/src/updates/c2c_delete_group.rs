use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_by: UserId,
    pub group_name: String,
    pub members: Vec<UserId>,
}

pub type Response = SuccessOnly;
