use crate::LocalUserIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// The queue UserIndex 2.0.2155 sent to the LocalUserIndexes through, with unwrapped events. Only
// deserialized from that version's state and drained by the post_upgrade one-off, then removed
grouped_timer_job_batch!(LegacyLocalUserIndexEventBatch, CanisterId, LocalUserIndexEvent, 1000);

impl TimerJobItem for LegacyLocalUserIndexEventBatch {
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
