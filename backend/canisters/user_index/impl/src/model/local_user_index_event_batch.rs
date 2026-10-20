use crate::LocalUserIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// Batched per LocalUserIndex, so that the events for every user it holds are sent to it together
grouped_timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalUserIndexEvent>,
    1000
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = local_user_index_canister_c2c_client::c2c_user_index(
            self.key,
            &local_user_index_canister::c2c_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // A receiver not yet upgraded to take these is retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
