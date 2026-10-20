use crate::IdentityEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(IdentityEventBatch, CanisterId, IdempotentEnvelope<IdentityEvent>, 100);

impl TimerJobItem for IdentityEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = identity_canister_c2c_client::c2c_user_index(
            self.state,
            &identity_canister::c2c_user_index::Args {
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
