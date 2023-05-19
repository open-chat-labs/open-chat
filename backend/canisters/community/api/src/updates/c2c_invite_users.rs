use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CommunityGroupId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub users: Vec<(UserId, Principal)>,
    pub group: Option<CommunityGroupId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInCommunity,
    NotAuthorized,
    CommunityFrozen,
    TooManyInvites(u32),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
}
