use local_user_index_canister::LocalGroupIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, UnitResult};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalGroupIndexEvent>,
    20
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = local_user_index_canister_c2c_client::c2c_local_group_index(
            self.state,
            &local_user_index_canister::c2c_local_group_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(UnitResult::Success) => Ok(()),
            Ok(UnitResult::Error(_)) => Err(false),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
