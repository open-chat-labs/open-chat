use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::DiamondMembershipSubscription;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, update_diamond_membership_subscription)]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, update_diamond_membership_subscription)]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
}
