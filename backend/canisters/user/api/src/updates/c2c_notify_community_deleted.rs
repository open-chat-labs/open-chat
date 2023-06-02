use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::DeletedCommunityInfo;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_community: DeletedCommunityInfo,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
