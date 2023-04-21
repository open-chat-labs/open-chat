use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub all_time: bool,
    pub year: Option<u32>,
    pub month: Option<u32>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<ReferralStats>),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ReferralStats {
    pub user_id: UserId,
    pub username: String,
    pub total_rewards_e8s: u64,
    pub diamond_members: u32,
    pub total_users: u32,
}
