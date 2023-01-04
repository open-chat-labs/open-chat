use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventResult {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
}
