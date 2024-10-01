use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(notifications_index, remove_subscription)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub p256dh_key: String,
}

#[ts_export(notifications_index, remove_subscription)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
