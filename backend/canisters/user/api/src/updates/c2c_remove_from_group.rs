use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Args {
    pub removed_by: UserId,
    pub blocked: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
