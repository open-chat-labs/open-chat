use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
}
