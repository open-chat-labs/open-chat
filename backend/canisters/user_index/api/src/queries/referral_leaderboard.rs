use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use ts_rs::TS;
use types::UserId;

type Year = u32;
type Month = u8;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub struct Args {
    pub filter: Option<LeaderboardFilter>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub enum LeaderboardFilter {
    Month(YearAndMonth),
    CurrentMonth,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub enum Response {
    AllTime(Vec<ReferralStats>),
    Month(MonthSuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub struct YearAndMonth {
    pub year: Year,
    pub month: Month,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub struct MonthSuccessResult {
    pub year: Year,
    pub month: Month,
    pub results: Vec<ReferralStats>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_leaderboard)]
pub struct ReferralStats {
    pub user_id: UserId,
    pub username: String,
    pub total_rewards_e8s: u64,
    pub diamond_members: u32,
    pub total_users: u32,
}
