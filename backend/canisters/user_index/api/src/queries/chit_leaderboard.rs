use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(user_index, chit_leaderboard)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(SuccessResult),
}

#[ts_export(user_index, chit_leaderboard)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SuccessResult {
    pub all_time: Vec<ChitUserBalance>,
    pub this_month: Vec<ChitUserBalance>,
    pub last_month: Vec<ChitUserBalance>,
}

#[ts_export(user_index, chit_leaderboard)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub username: String,
    pub balance: u32,
}
