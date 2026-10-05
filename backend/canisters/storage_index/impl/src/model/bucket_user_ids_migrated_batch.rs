use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds, UserId};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Kept apart from the other events synced to the buckets, and sent in larger batches, so that telling
// every bucket of every user migrated so far doesn't hold up the users and files queued behind them
grouped_timer_job_batch!(BucketUserIdsMigratedBatch, CanisterId, (UserId, UserId), 10000);

impl TimerJobItem for BucketUserIdsMigratedBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let args = storage_bucket_canister::c2c_sync_index::Args {
            user_ids_migrated: Some(self.items.clone()),
            ..Default::default()
        };

        match storage_bucket_canister_c2c_client::c2c_sync_index(self.key, &args).await {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
