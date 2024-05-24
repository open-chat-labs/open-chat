use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<ChitUserBalance>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub username: String,
    pub balance: u32,
}
