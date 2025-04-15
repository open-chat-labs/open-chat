use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityId, EmptySuccessOrError};

#[ts_export(user, leave_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

pub type Response = EmptySuccessOrError;
