use candid::CandidType;
use ts_export::ts_export;
use types::DiamondMembershipSubscription;

#[ts_export(user_index, update_diamond_membership_subscription)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub pay_in_chat: Option<bool>,
    pub subscription: Option<DiamondMembershipSubscription>,
}

#[ts_export(user_index, update_diamond_membership_subscription)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotDiamondMember,
    AlreadyLifetimeDiamondMember,
}
