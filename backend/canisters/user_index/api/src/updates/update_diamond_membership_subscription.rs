use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::DiamondMembershipSubscription;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
}
