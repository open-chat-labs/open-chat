use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PushEventResult {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
