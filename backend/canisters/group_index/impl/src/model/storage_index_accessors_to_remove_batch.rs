use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{AccessorId, CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(StorageIndexAccessorsToRemoveBatch, CanisterId, AccessorId, 1000);

impl TimerJobItem for StorageIndexAccessorsToRemoveBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = storage_index_canister_c2c_client::remove_accessors(
            self.state,
            &storage_index_canister::remove_accessors::Args {
                accessor_ids: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
