use notifications_index_canister::UserIndexEvent;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentMessage};
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(
    NotificationsIndexEventBatch,
    CanisterId,
    IdempotentMessage<UserIndexEvent>,
    100
);

impl TimerJobItem for NotificationsIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = notifications_index_canister_c2c_client::c2c_sync_user_index_events(
            self.key,
            &notifications_index_canister::c2c_sync_user_index_events::Args {
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
