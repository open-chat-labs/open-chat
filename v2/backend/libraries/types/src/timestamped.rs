use crate::TimestampMillis;
use candid::CandidType;
use serde::Deserialize;
use std::fmt::Debug;

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct Timestamped<T: CandidType + Debug + Clone> {
    pub value: T,
    pub timestamp: TimestampMillis,
}

impl<T: CandidType + Debug + Clone> Timestamped<T> {
    pub fn new(value: T, now: TimestampMillis) -> Timestamped<T> {
        Timestamped { value, timestamp: now }
    }

    pub fn if_set_after(&self, timestamp: TimestampMillis) -> Option<&T> {
        if self.timestamp > timestamp {
            Some(&self.value)
        } else {
            None
        }
    }
}
