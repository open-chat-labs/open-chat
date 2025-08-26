use candid::Principal;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(StorageIndexUsersToRemoveBatch, CanisterId, Principal, 1000);

impl TimerJobItem for StorageIndexUsersToRemoveBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
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
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
