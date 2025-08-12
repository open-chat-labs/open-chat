use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityId, SuccessOnly};

#[ts_export(user, set_community_indexes)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub indexes: Vec<(CommunityId, u32)>,
}

pub type Response = SuccessOnly;
