use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{CommunityId, EventWrapper, GroupFrozen, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_community)]
pub struct Args {
    pub community_id: CommunityId,
    #[ts(optional)]
    pub reason: Option<String>,
    #[ts(optional)]
    pub suspend_members: Option<SuspensionDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_community)]
pub struct SuspensionDetails {
    #[ts(optional)]
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_community)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupFrozen")] EventWrapper<GroupFrozen>),
    CommunityAlreadyFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
}
