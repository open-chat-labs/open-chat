use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CommunityGroupId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserSuspended,
    CallerNotInCommunity,
    GroupNotFound,
    UserNotInGroup,
    NotAuthorized,
}
