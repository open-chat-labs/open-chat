use storage_index_canister::add_or_update_users::UserConfig;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(StorageIndexUserConfigBatch, CanisterId, UserConfig, 1000);

impl TimerJobItem for StorageIndexUserConfigBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = storage_index_canister_c2c_client::add_or_update_users(
            self.key,
            &storage_index_canister::add_or_update_users::Args {
                users: self.items.clone(),
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
