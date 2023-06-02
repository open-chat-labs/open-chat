use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CommunityId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityNotFound,
    CommunityNotPublic,
    UserNotInCommunity,
    LastOwnerCannotLeave,
    UserSuspended,
    CommunityFrozen,
    InternalError(String),
}
