use crate::TimestampMillis;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use std::ops::Deref;

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct Timestamped<T> {
    #[serde(rename = "v")]
    pub value: T,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
}

impl<T> Timestamped<T> {
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

    pub fn update<F: FnOnce(&mut T) -> bool>(&mut self, update_fn: F, now: TimestampMillis) -> bool {
        if update_fn(&mut self.value) {
            self.timestamp = now;
            true
        } else {
            false
        }
    }
}

impl<T: Default> Default for Timestamped<T> {
    fn default() -> Self {
        Timestamped {
            value: T::default(),
            timestamp: TimestampMillis::default(),
        }
    }
}

impl<T> Deref for Timestamped<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}
