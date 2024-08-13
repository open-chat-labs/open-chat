use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::DiamondMembershipFees;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_diamond_membership_fees)]
pub struct Args {
    pub fees: DiamondMembershipFees,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_diamond_membership_fees)]
pub enum Response {
    Success,
    Invalid,
}
