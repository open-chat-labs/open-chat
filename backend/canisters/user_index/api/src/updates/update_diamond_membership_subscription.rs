use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::DiamondMembershipSubscription;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
}
