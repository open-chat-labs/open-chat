use storage_bucket_canister::c2c_vault_sync::VaultOp;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

grouped_timer_job_batch!(VaultEventBatch, CanisterId, VaultOp, 200);

impl TimerJobItem for VaultEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let args = storage_bucket_canister::c2c_vault_sync::Args { ops: self.items.clone() };

        let response = storage_bucket_canister_c2c_client::c2c_vault_sync(self.key, &args).await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
