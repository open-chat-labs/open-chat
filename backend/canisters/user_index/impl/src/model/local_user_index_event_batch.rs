use crate::LocalUserIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per LocalUserIndex, so that the events for every user it holds are sent to it together
grouped_timer_job_batch!(LocalUserIndexEventBatch, CanisterId, LocalUserIndexEvent, 1000);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = local_user_index_canister_c2c_client::c2c_notify_user_index_events(
            self.key,
            &local_user_index_canister::c2c_notify_user_index_events::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
