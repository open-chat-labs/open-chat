use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CommunityId;

#[ts_export(user, leave_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

#[ts_export(user, leave_community)]
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
    Error(u16, Option<String>),
}
