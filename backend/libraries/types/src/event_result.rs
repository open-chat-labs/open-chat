use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PushEventResult {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
