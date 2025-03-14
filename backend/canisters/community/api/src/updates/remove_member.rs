use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(community, remove_member)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(community, remove_member)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    CannotRemoveSelf,
    CannotRemoveUser,
    NotAuthorized,
    TargetUserNotInCommunity,
    UserSuspended,
    CommunityFrozen,
    InternalError(String),
    UserLapsed,
    Error(u16, Option<String>),
}
