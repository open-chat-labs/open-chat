use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_optional::ts_optional;
use ts_rs::TS;

#[ts_optional]
#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct PushEventResult {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
