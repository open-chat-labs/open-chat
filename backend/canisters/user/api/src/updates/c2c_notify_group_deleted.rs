use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::DeletedGroupInfo;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_group: DeletedGroupInfo,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
