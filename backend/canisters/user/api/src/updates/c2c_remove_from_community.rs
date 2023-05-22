use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

// TODO: Implement this method
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub removed_by: UserId,
    pub blocked: bool,
    pub community_name: String,
    pub public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CannotRemoveUser,
}
