use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_ids: Vec<ChatId>,
    pub community_ids: Vec<CommunityId>,
    pub active_in_last: Option<Milliseconds>,
}

pub type Response = crate::active_groups::Response;
