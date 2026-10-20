use crate::{mutate_state, read_state};
use storage_index_canister::StorageBucketEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// The bucket's only queue to the StorageIndex: the index's idempotency check keeps one high-water
// mark per bucket, so a second queue would have its retried batches dropped as already seen
timer_job_batch!(
    StorageIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<StorageBucketEvent>,
    1000
);

impl TimerJobItem for StorageIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        // The figures as they are when the batch is sent, which the index applies whatever it makes
        // of the events
        let total_file_bytes = read_state(|state| state.data.files.total_file_bytes());
        let response = storage_index_canister_c2c_client::c2c_storage_bucket(
            self.state,
            &storage_index_canister::c2c_storage_bucket::Args {
                events: self.items.clone(),
                heap_memory_used: utils::memory::heap(),
                stable_memory_used: utils::memory::stable(),
                total_file_bytes,
            },
        )
        .await;

        match response {
            Ok(storage_index_canister::c2c_storage_bucket::Response::Success(result)) => {
                // The same however many times the batch was sent, so applying it again is harmless
                mutate_state(|state| {
                    for file in result.files_rejected {
                        state.data.reject_file(file);
                    }
                });
                Ok(())
            }
            // A StorageIndex not yet upgraded to take these is retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
