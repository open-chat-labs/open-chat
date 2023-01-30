use crate::{EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventWrapper<T: CandidType + Clone + Debug> {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub correlation_id: u64,
    pub expires_at: Option<TimestampMillis>,
    pub event: T,
}

impl<T: CandidType + Clone + Debug> EventWrapper<T> {
    pub fn is_expired(&self, now: TimestampMillis) -> bool {
        self.expires_at.map_or(false, |expiry| expiry < now)
    }
}
