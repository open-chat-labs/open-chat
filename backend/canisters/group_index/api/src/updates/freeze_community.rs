use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityId, EventWrapper, GroupFrozen, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub reason: Option<String>,
    pub suspend_members: Option<SuspensionDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<GroupFrozen>),
    CommunityAlreadyFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
}
