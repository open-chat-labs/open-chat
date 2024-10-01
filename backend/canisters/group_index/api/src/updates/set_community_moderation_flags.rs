use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CommunityId;

#[ts_export(group_index, set_community_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub flags: u32,
}

#[ts_export(group_index, set_community_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Unchanged,
    CommunityNotFound,
    NotAuthorized,
    InvalidFlags,
    InternalError(String),
}
