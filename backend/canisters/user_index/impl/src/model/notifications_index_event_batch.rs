use notifications_index_canister::UserIndexEvent as NotificationsIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(
    NotificationsIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<NotificationsIndexEvent>,
    1000
);

impl TimerJobItem for NotificationsIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = notifications_index_canister_c2c_client::c2c_user_index(
            self.state,
            &notifications_index_canister::c2c_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // TODO switch to `delay_if_should_retry_failed_c2c_call` once the NotificationsIndex
            // has been upgraded to have `c2c_user_index`
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
