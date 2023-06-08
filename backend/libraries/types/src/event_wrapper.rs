use crate::{is_default, EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventWrapper<T> {
    #[serde(rename = "i", alias = "index")]
    pub index: EventIndex,
    #[serde(rename = "t", alias = "timestamp")]
    pub timestamp: TimestampMillis,
    #[serde(rename = "c", alias = "correlation_id", default, skip_serializing_if = "is_default")]
    pub correlation_id: u64,
    #[serde(rename = "x", alias = "expires_at", default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<TimestampMillis>,
    #[serde(rename = "e", alias = "event")]
    pub event: T,
}

impl<T> EventWrapper<T> {
    pub fn is_expired(&self, now: TimestampMillis) -> bool {
        self.expires_at.map_or(false, |expiry| expiry < now)
    }
}
