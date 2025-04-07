use crate::LocalUserIndexEvent;
use timer_job_queues::{timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalUserIndexEvent>,
    100
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = local_user_index_canister_c2c_client::c2c_user_canister(
            self.state,
            &local_user_index_canister::c2c_user_canister::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_notify_user_events::Response::Success) => Ok(()),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
