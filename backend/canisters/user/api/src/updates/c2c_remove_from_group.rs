use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Args {
    pub removed_by: UserId,
    pub blocked: bool,
    pub group_name: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
