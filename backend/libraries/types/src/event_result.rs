use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct PushEventResult {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    #[ts(optional)]
    pub expires_at: Option<TimestampMillis>,
}
