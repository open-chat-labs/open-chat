use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CommunityId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub tags: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Unchanged,
    CommunityNotFound,
    NotAuthorized,
    InvalidTags,
    InternalError(String),
}
