use candid::Principal;
use timer_job_queues::{timer_job_batch, TimerJobItem};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(StorageIndexUsersToRemoveBatch, CanisterId, Principal, 1000);

impl TimerJobItem for StorageIndexUsersToRemoveBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = storage_index_canister_c2c_client::remove_users(
            self.state,
            &storage_index_canister::remove_users::Args {
                user_ids: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
