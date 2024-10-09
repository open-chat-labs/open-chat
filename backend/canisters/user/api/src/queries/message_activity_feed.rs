use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

use crate::MessageActivityEvent;

#[ts_export(user, activity_feed)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub since: TimestampMillis,
}

#[ts_export(user, activity_feed)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, activity_feed)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<MessageActivityEvent>,
    pub total: u32,
}
