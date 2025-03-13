use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::DiamondMembershipSubscription;

#[ts_export(user_index, update_diamond_membership_subscription)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[ts_export(user_index, update_diamond_membership_subscription)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
    Error(u16, Option<String>),
}
