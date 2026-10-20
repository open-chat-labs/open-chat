use candid::Deserialize;
use constants::DAY_IN_MS;
use serde::Serialize;
use storage_index_canister::StorageBucketEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, FileAdded, FileRemoved, Milliseconds};

// The queue to `c2c_sync_bucket` which buckets sent through before `storage_index_event_sync_queue`. Only
// deserialized from their state, which the post_upgrade one-off drains at once. It never sends anything
// itself, so nothing leaves except through the drain, and nothing goes to an endpoint the tidy removes.
// Removed with the one-off.
timer_job_batch!(IndexEventBatch, CanisterId, (EventToSync, u64), 1000);

#[derive(Serialize, Deserialize)]
pub enum EventToSync {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
    CsamMatch(storage_index_canister::CsamMatch),
    CsamHashDenylisted(storage_index_canister::CsamHashDenylisted),
}

impl TimerJobItem for IndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}

impl From<EventToSync> for StorageBucketEvent {
    fn from(event: EventToSync) -> Self {
        match event {
            EventToSync::FileAdded(file) => StorageBucketEvent::FileAdded(file),
            EventToSync::FileRemoved(file) => StorageBucketEvent::FileRemoved(file),
            EventToSync::CsamMatch(csam_match) => StorageBucketEvent::CsamMatch(csam_match),
            EventToSync::CsamHashDenylisted(denylisted) => StorageBucketEvent::CsamHashDenylisted(denylisted),
        }
    }
}
