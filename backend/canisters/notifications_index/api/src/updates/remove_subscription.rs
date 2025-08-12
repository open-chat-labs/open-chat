use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

#[ts_export(notifications_index, remove_subscription)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub p256dh_key: String,
}

pub type Response = SuccessOnly;
