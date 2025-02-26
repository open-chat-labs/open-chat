use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{CanisterId, TimestampMillis};

// Ensures messages are not processed multiple times.
// Messages must be sent in the order in which they were created (ie. `created_at` must be
// monotonically increasing).
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IdempotencyChecker {
    #[serde(rename = "s")]
    per_sender: HashMap<CanisterId, IdempotencyCheckerPerSender>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
struct IdempotencyCheckerPerSender {
    #[serde(rename = "c")]
    latest_created_at: TimestampMillis,
    #[serde(rename = "i")]
    idempotency_ids: HashSet<u64>,
}

impl IdempotencyChecker {
    pub fn check(&mut self, sender: CanisterId, created_at: TimestampMillis, idempotency_id: u64) -> bool {
        // Temp hack in case the sending side has not been upgraded yet
        if idempotency_id == 0 && created_at == 0 {
            return true;
        }

        let checker = self.per_sender.entry(sender).or_default();

        // `created_at` is monotonically increasing, so given that `created_at` is lower for
        // this incoming message than the latest processed message, we know this message has
        // already been processed, so return false.
        if checker.latest_created_at > created_at {
            return false;
        }

        // If `created_at` for this new message is later than for the latest already processed
        // message, then bump `latest_created_at` and clear the set of `idempotency_ids` since they
        // were only relevant for the previous `created_at` value.
        if checker.latest_created_at > created_at {
            checker.idempotency_ids.clear();
            checker.latest_created_at = created_at;
        }
        checker.idempotency_ids.insert(idempotency_id)
    }
}
