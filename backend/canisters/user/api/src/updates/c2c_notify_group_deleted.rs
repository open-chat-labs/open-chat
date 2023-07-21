use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::DeletedGroupInfoInternal;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_group: DeletedGroupInfoInternal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
