use candid::CandidType;
use ts_export::ts_export;
use types::{Cryptocurrency, Empty};

pub type Args = Empty;

#[allow(clippy::large_enum_variant)]
#[ts_export(user_index, diamond_membership_fees)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Vec<DiamondMembershipFees>),
}

#[ts_export(user_index, diamond_membership_fees)]
#[derive(CandidType, Debug)]
pub struct DiamondMembershipFees {
    pub token: Cryptocurrency,
    pub one_month: u64,
    pub three_months: u64,
    pub one_year: u64,
    pub lifetime: u64,
}
