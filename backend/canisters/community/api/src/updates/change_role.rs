use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityRole, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: CommunityRole,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInCommunity,
    NotAuthorized,
    UserNotInCommunity,
    UserSuspended,
    Invalid,
    CommunityFrozen,
    InternalError(String),
}
