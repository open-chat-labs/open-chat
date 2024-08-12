use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(Vec<ChitUserBalance>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub username: String,
    pub balance: u32,
}
