use notifications_index_canister::UserIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(
    NotificationsIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<UserIndexEvent>,
    100
);

impl TimerJobItem for NotificationsIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = notifications_index_canister_c2c_client::c2c_user_index(
            self.state,
            &notifications_index_canister::c2c_user_index::Args {
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
