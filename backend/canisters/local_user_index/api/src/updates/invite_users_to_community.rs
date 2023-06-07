use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    NotAuthorized,
    CommunityFrozen,
    TooManyInvites(u32),
    UserSuspended,
    InternalError(String),
}
