use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{CommunityId, EventWrapper, GroupUnfrozen};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, unfreeze_group)]
pub struct Args {
    pub community_id: CommunityId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, unfreeze_group)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupUnfrozen")] EventWrapper<GroupUnfrozen>),
    CommunityNotFrozen,
    CommunityNotFound,
    NotAuthorized,
    InternalError(String),
}
