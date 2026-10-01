use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityId, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

pub type Response = UnitResult;
