use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityId, EventWrapper, GroupUnfrozen};

#[ts_export(group_index, unfreeze_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

#[ts_export(group_index, unfreeze_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupUnfrozen")] EventWrapper<GroupUnfrozen>),
    CommunityNotFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
    Error(u16, Option<String>),
}
