use group_index_canister::UserIndexEvent as GroupIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(GroupIndexEventBatch, CanisterId, IdempotentEnvelope<GroupIndexEvent>, 1000);

impl TimerJobItem for GroupIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = group_index_canister_c2c_client::c2c_user_index(
            self.state,
            &group_index_canister::c2c_user_index::Args {
                events: self.items.clone(),
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
