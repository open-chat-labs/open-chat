use crate::LocalGroupIndexEvent;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(
    LocalGroupIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalGroupIndexEvent>,
    1000
);

impl TimerJobItem for LocalGroupIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = local_group_index_canister_c2c_client::c2c_group_index(
            self.key,
            &local_group_index_canister::c2c_group_index::Args {
                events: self.items.clone(),
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
