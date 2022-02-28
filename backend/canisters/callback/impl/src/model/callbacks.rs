use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::collections::{BTreeMap, VecDeque};
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Callbacks {
    callbacks: BTreeMap<TimestampMillis, VecDeque<Callback>>,
    failed: Vec<FailedCallback>,
    pending: u64,
    completed: u64,
}

impl Callbacks {
    pub fn add(&mut self, callback: Callback, timestamp: TimestampMillis) {
        self.callbacks.entry(timestamp).or_default().push_back(callback);
        self.pending += 1;
    }

    pub fn record_callback_completed(&mut self) {
        self.completed += 1;
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
        self.pending -= callbacks_due.len() as u64;
        callbacks_due
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            pending: self.pending,
            completed: self.completed,
            failed: self.failed.len() as u64,
            next_callback_due: self.callbacks.keys().copied().next().unwrap_or_default(),
        }
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

pub struct Metrics {
    pub pending: u64,
    pub completed: u64,
    pub failed: u64,
    pub next_callback_due: TimestampMillis,
}
