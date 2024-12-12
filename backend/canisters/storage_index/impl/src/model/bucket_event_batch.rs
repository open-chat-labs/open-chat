use crate::model::bucket_sync_state::EventToSync;
use crate::MAX_EVENTS_TO_SYNC_PER_BATCH;
use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

pub struct BucketEventBatch {
    canister_id: CanisterId,
    events: Vec<EventToSync>,
}

impl TimerJobItem for BucketEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let mut args = storage_bucket_canister::c2c_sync_index::Args::default();
        for event in &self.events {
            match event {
                EventToSync::UserAdded(a) => args.users_added.push(*a),
                EventToSync::UserRemoved(r) => args.users_removed.push(*r),
                EventToSync::AccessorRemoved(r) => args.accessors_removed.push(*r),
                EventToSync::UserIdUpdated(old, new) => args.user_ids_updated.push((*old, *new)),
                EventToSync::FileToRemove(file_id) => args.files_to_remove.push(*file_id),
            }
        }

        let response = storage_bucket_canister_c2c_client::c2c_sync_index(self.canister_id, &args).await;

        match response {
            Ok(_) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}

impl TimerJobItemGroup for BucketEventBatch {
    type Key = CanisterId;
    type Item = EventToSync;

    fn new(canister_id: Self::Key) -> Self {
        BucketEventBatch {
            canister_id,
            events: Vec::new(),
        }
    }

    fn key(&self) -> Self::Key {
        self.canister_id
    }

    fn add(&mut self, item: Self::Item) {
        self.events.push(item);
    }

    fn into_items(self) -> Vec<Self::Item> {
        self.events
    }

    fn is_full(&self) -> bool {
        self.events.len() >= MAX_EVENTS_TO_SYNC_PER_BATCH
    }
}
