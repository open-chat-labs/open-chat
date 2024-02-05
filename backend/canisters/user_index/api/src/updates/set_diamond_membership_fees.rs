use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::DiamondMembershipFees;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub fees: DiamondMembershipFees,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Invalid,
}
