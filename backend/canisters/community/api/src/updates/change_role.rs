use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityRole, UserId};

#[ts_export(community, change_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: CommunityRole,
}

#[ts_export(community, change_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    NotAuthorized,
    TargetUserNotInCommunity,
    UserSuspended,
    Invalid,
    CommunityFrozen,
    InternalError(String),
    UserLapsed,
    Error(u16, Option<String>),
}
