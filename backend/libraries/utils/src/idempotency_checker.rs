use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use types::{CanisterId, TimestampMillis};

// Ensures messages are not processed multiple times.
// Messages must be sent in the order in which they were created (ie. `created_at` must be
// monotonically increasing).
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IdempotencyChecker {
    previous_message_per_sender: HashMap<CanisterId, BTreeSet<(TimestampMillis, u64)>>,
}

impl IdempotencyChecker {
    pub fn check(&mut self, sender: CanisterId, created_at: TimestampMillis, idempotency_id: u64) -> bool {
        // Temp hack in case the sending side has not been upgraded yet
        if idempotency_id == 0 && created_at == 0 {
            return true;
        }

        let previous_messages = self.previous_message_per_sender.entry(sender).or_default();

        if previous_messages.last().is_some_and(|(ts, _)| *ts > created_at) {
            // `created_at` is monotonically increasing, so given that `created_at` is lower for
            // this incoming message than one of the processed messages, we know this message has
            // already been processed, so return false.
            false
        } else if !previous_messages.insert((created_at, idempotency_id)) {
            false
        } else {
            // Clear all messages which were created at an earlier date
            while let Some((ts, _)) = previous_messages.first() {
                if *ts < created_at {
                    previous_messages.pop_first();
                }
            }
            true
        }
    }
}
