use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::DiamondMembershipSubscription;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/updateDiamondMembershipSubscription.ts")]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/updateDiamondMembershipSubscription.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
}
