use candid::Principal;
use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{AccessorId, CanisterId, FileId, Milliseconds};

// Replaced by an event queue, and drained into it by the post_upgrade one-off. It never sends anything
// itself, so nothing leaves except through the drain, and nothing goes to an endpoint the tidy removes.
// Removed with the one-off.
grouped_timer_job_batch!(BucketEventBatch, CanisterId, EventToSync, 1000);

#[derive(Serialize, Deserialize, Clone)]
pub enum EventToSync {
    UserAdded(Principal),
    UserRemoved(Principal),
    AccessorRemoved(AccessorId),
    FileToRemove(FileId),
}

impl TimerJobItem for BucketEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}
