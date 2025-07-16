use notifications_index_canister::NotificationsIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

grouped_timer_job_batch!(
    LocalIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<NotificationsIndexEvent>,
    1000
);

impl TimerJobItem for LocalIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let args = local_user_index_canister::c2c_notifications_index::Args {
            events: self.items.clone(),
        };

        let response = local_user_index_canister_c2c_client::c2c_notifications_index(self.key, &args).await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
