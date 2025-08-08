use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DeletedGroupInfoInternal, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_group: DeletedGroupInfoInternal,
}

pub type Response = SuccessOnly;
