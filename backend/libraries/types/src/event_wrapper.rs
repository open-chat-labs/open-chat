use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventWrapper<T: CandidType + Clone + Debug> {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    #[serde(default)]
    pub correlation_id: u64,
    pub event: T,
}
