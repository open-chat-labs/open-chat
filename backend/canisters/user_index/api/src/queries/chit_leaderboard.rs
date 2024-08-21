use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, chit_leaderboard)]
pub enum Response {
    Success(Vec<ChitUserBalance>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[ts_export(user_index, chit_leaderboard)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub username: String,
    pub balance: u32,
}
