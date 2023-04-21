use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub referral_type: ReferralType,
    pub codes: Vec<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum ReferralType {
    BtcMiami,
    User,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
