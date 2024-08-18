use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::CommunityId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, set_community_moderation_flags)]
pub struct Args {
    pub community_id: CommunityId,
    pub flags: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, set_community_moderation_flags)]
pub enum Response {
    Success,
    Unchanged,
    CommunityNotFound,
    NotAuthorized,
    InvalidFlags,
    InternalError(String),
}
