use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, Milliseconds, UserId};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(StorageIndexUserIdsMigratedBatch, CanisterId, (UserId, UserId), 1000);

impl TimerJobItem for StorageIndexUserIdsMigratedBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = storage_index_canister_c2c_client::c2c_user_ids_migrated(
            self.state,
            &storage_index_canister::c2c_user_ids_migrated::Args {
                user_ids: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // Includes a StorageIndex not yet upgraded to have `c2c_user_ids_migrated`, which is
            // retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
