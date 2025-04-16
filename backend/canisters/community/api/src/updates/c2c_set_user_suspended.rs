use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub suspended: bool,
}

pub type Response = UnitResult;
