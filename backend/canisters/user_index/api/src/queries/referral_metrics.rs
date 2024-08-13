use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_metrics)]
pub enum Response {
    Success(ReferralMetrics),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, referral_metrics)]
pub struct ReferralMetrics {
    pub users_who_referred: u32,
    pub users_who_referred_paid_diamond: u32,
    pub users_who_referred_unpaid_diamond: u32,
    pub users_who_referred_90_percent_unpaid_diamond: u32,
    pub referrals_of_paid_diamond: u32,
    pub referrals_of_unpaid_diamond: u32,
    pub referrals_other: u32,
    pub icp_raised_by_referrals_to_paid_diamond: u32,
}
