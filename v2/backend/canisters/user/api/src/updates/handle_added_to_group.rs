use candid::CandidType;
use serde::Deserialize;
use shared::types::UserId;

#[derive(CandidType, Deserialize, Clone)]
pub struct Args {
    pub added_by: UserId,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    Blocked,
}
