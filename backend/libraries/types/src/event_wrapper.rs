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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<TimestampMillis>,
    pub event: T,
}

impl<T: CandidType + Clone + Debug> EventWrapper<T> {
    pub fn is_expired(&self, now: TimestampMillis) -> bool {
        self.expires_at.map_or(false, |expiry| expiry < now)
    }
}
