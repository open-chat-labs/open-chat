use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::collections::{BTreeMap, VecDeque};
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Callbacks {
    callbacks: BTreeMap<TimestampMillis, VecDeque<Callback>>,
    failed: Vec<FailedCallback>,
}

impl Callbacks {
    pub fn add(&mut self, callback: Callback, timestamp: TimestampMillis) {
        self.callbacks.entry(timestamp).or_default().push_back(callback);
    }

    pub fn record_failed_callback(&mut self, callback: FailedCallback) {
        self.failed.push(callback);
    }

    pub fn take_next_due(&mut self, now: TimestampMillis, max_count: usize) -> Vec<Callback> {
        let mut callbacks_due = Vec::new();
        while let Some((timestamp, callbacks)) = self.callbacks.iter_mut().next().filter(|(&t, _)| t <= now) {
            while let Some(callback) = callbacks.pop_front() {
                callbacks_due.push(callback);
                if callbacks_due.len() >= max_count {
                    break;
                }
            }

            if callbacks.is_empty() {
                let timestamp = *timestamp;
                self.callbacks.remove(&timestamp);
            }
            if callbacks_due.len() >= max_count {
                break;
            }
        }
        callbacks_due
    }
}

#[derive(Serialize, Deserialize)]
pub struct Callback {
    pub canister_id: CanisterId,
    pub method_name: String,
    pub payload: ByteBuf,
    pub is_retry: bool,
}

#[derive(Serialize, Deserialize)]
pub struct FailedCallback {
    pub timestamp: TimestampMillis,
    pub callback: Callback,
    pub error_message: String,
}
