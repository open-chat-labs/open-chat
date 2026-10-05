use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Each as (old id, new id)
    pub user_ids: Vec<(UserId, UserId)>,
}

pub type Response = SuccessOnly;
