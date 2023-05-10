use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ReferralType;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub referral_type: ReferralType,
    pub codes: Vec<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
