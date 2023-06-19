use crate::{is_default, EventIndex, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventWrapper<T> {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub correlation_id: u64,
    pub expires_at: Option<TimestampMillis>,
    pub event: T,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EventWrapperInternal<T> {
    #[serde(rename = "i")]
    pub index: EventIndex,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
    #[serde(rename = "c", default, skip_serializing_if = "is_default")]
    pub correlation_id: u64,
    #[serde(rename = "x", default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<TimestampMillis>,
    #[serde(rename = "e")]
    pub event: T,
}

impl<T> EventWrapperInternal<T> {
    pub fn is_expired(&self, now: TimestampMillis) -> bool {
        self.expires_at.map_or(false, |expiry| expiry < now)
    }
}

impl<T> From<EventWrapperInternal<T>> for EventWrapper<T> {
    fn from(value: EventWrapperInternal<T>) -> Self {
        EventWrapper {
            index: value.index,
            timestamp: value.timestamp,
            correlation_id: value.correlation_id,
            expires_at: value.expires_at,
            event: value.event,
        }
    }
}
