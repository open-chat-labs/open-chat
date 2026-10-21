use storage_bucket_canister::StorageIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// Batched per bucket
grouped_timer_job_batch!(
    StorageBucketEventBatch,
    CanisterId,
    IdempotentEnvelope<StorageIndexEvent>,
    1000
);

impl TimerJobItem for StorageBucketEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = storage_bucket_canister_c2c_client::c2c_storage_index(
            self.key,
            &storage_bucket_canister::c2c_storage_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // A receiver not yet upgraded to take these is retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
