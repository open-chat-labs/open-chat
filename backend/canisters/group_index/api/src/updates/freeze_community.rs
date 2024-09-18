use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityId, EventWrapper, GroupFrozen, Milliseconds};

#[ts_export(group_index, freeze_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub reason: Option<String>,
    pub suspend_members: Option<SuspensionDetails>,
}

#[ts_export(group_index, freeze_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[ts_export(group_index, freeze_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupFrozen")] EventWrapper<GroupFrozen>),
    CommunityAlreadyFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
}
