use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityId, EventWrapper, GroupUnfrozen};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<GroupUnfrozen>),
    CommunityNotFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
}
