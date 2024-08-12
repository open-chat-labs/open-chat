use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{Cryptocurrency, Empty};

pub type Args = Empty;

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(Vec<DiamondMembershipFees>),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct DiamondMembershipFees {
    pub token: Cryptocurrency,
    pub one_month: u64,
    pub three_months: u64,
    pub one_year: u64,
    pub lifetime: u64,
}
