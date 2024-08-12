use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::DiamondMembershipFees;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/setDiamondMembershipFees/")]
pub struct Args {
    pub fees: DiamondMembershipFees,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/setDiamondMembershipFees/")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
    Invalid,
}
