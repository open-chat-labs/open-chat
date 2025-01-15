use crate::model::users::FileStatusInternal;
use crate::mutate_state;
use candid::Deserialize;
use serde::Serialize;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem, TimerJobItemGroup};
use types::{CanisterId, FileAdded, FileRemoved};
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(IndexEventBatch, CanisterId, (EventToSync, u64), 1000);

#[derive(Serialize, Deserialize)]
pub enum EventToSync {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
}

impl TimerJobItem for IndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let mut args = storage_index_canister::c2c_sync_bucket::Args {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            ..Default::default()
        };

        for (event, total_file_bytes) in &self.items {
            match event {
                EventToSync::FileAdded(file) => {
                    args.files_added.push(file.clone());
                }
                EventToSync::FileRemoved(file) => {
                    args.files_removed.push(file.clone());
                }
            }
            args.total_file_bytes = *total_file_bytes;
        }

        let response = storage_index_canister_c2c_client::c2c_sync_bucket(self.key, &args).await;

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
