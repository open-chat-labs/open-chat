use candid::Principal;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(StorageIndexUsersToRemoveBatch, CanisterId, Principal, 1000);

impl TimerJobItem for StorageIndexUsersToRemoveBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = storage_index_canister_c2c_client::remove_users(
            self.key,
            &storage_index_canister::remove_users::Args {
                user_ids: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
