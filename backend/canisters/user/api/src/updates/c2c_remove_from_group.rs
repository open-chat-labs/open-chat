use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub removed_by: UserId,
    pub blocked: bool,
    pub group_name: String,
    pub public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CannotRemoveUser,
}
