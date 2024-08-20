use candid::CandidType;
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(user_index, chit_leaderboard)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Vec<ChitUserBalance>),
}

#[ts_export(user_index, chit_leaderboard)]
#[derive(CandidType, Clone, Debug)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub username: String,
    pub balance: u32,
}
