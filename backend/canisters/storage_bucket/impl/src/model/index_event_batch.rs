use crate::model::users::FileStatusInternal;
use crate::{mutate_state, DATA_LIMIT_BYTES, MAX_EVENTS_TO_SYNC_PER_BATCH};
use candid::Deserialize;
use serde::Serialize;
use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::{CanisterId, FileAdded, FileRemoved};
use utils::canister::should_retry_failed_c2c_call;

pub struct IndexEventBatch {
    canister_id: CanisterId,
    events: Vec<(EventToSync, u64)>,
}

#[derive(Serialize, Deserialize)]
pub enum EventToSync {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
}

impl TimerJobItem for IndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let mut args = storage_index_canister::c2c_sync_bucket::Args::default();

        for (event, bytes_used) in &self.events {
            match event {
                EventToSync::FileAdded(file) => {
                    args.files_added.push(file.clone());
                    args.bytes_used = *bytes_used;
                }
                EventToSync::FileRemoved(file) => {
                    args.files_removed.push(file.clone());
                }
            }
            args.bytes_used = *bytes_used;
            args.bytes_remaining = (DATA_LIMIT_BYTES as i64) - (args.bytes_used as i64);
        }

        let response = storage_index_canister_c2c_client::c2c_sync_bucket(self.canister_id, &args).await;

        match response {
            Ok(storage_index_canister::c2c_sync_bucket::Response::Success(result)) => {
                mutate_state(|state| {
                    for file in result.files_rejected {
                        let file_id = file.file_id;
                        let reason = file.reason.into();

                        if let Some(user_id) = state.data.files.owner(&file.file_id) {
                            if let Some(user) = state.data.users.get(&user_id) {
                                let old_status = state.data.users.set_file_status(
                                    user_id,
                                    user,
                                    file_id,
                                    FileStatusInternal::Rejected(reason),
                                );

                                if let Some(FileStatusInternal::Uploading(_)) = old_status {
                                    state.data.files.remove_pending_file(&file_id);
                                } else {
                                    state.data.files.remove(user_id, file_id);
                                }
                            }
                        }
                    }
                });
                Ok(())
            }
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}

impl TimerJobItemGroup for IndexEventBatch {
    type Key = CanisterId;
    type Item = (EventToSync, u64);

    fn new(canister_id: Self::Key) -> Self {
        IndexEventBatch {
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
