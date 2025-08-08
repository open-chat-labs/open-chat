use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DeletedCommunityInfo, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_community: DeletedCommunityInfo,
}

pub type Response = SuccessOnly;
