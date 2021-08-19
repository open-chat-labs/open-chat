use crate::TimestampMillis;
use candid::CandidType;
use serde::Deserialize;
use std::fmt::Debug;

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct Updatable<T: CandidType + Debug + Clone> {
    value: T,
    updated: TimestampMillis,
}

impl<T: CandidType + Debug + Clone> Updatable<T> {
    pub fn new(value: T, now: TimestampMillis) -> Updatable<T> {
        Updatable { value, updated: now }
    }

    pub fn value(&self) -> &T {
        &self.value
    }

    pub fn updated(&self) -> TimestampMillis {
        self.updated
    }

    pub fn set_value(&mut self, value: T, now: TimestampMillis) {
        self.value = value;
        self.updated = now;
    }
}
