use candid::CandidType;
use ts_export::ts_export;
use types::DiamondMembershipFees;

#[ts_export(user_index, set_diamond_membership_fees)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub fees: DiamondMembershipFees,
}

#[ts_export(user_index, set_diamond_membership_fees)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    Invalid,
}
