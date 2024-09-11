use candid::CandidType;
use ts_export::ts_export;
use types::SubscriptionInfo;

#[ts_export(notifications_index, push_subscription)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub subscription: SubscriptionInfo,
}

#[ts_export(notifications_index, push_subscription)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
