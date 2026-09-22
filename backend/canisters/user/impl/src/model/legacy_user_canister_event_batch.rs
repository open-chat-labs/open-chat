use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, Milliseconds, UserId};
use user_canister::UserCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// The queue of events as held before they were batched per canister, which `post_upgrade` drains
// into the queue which does so
// TODO: Remove this once every queue has been drained
grouped_timer_job_batch!(
    LegacyUserCanisterEventBatch,
    UserId,
    IdempotentEnvelope<UserCanisterEvent>,
    100
);

impl TimerJobItem for LegacyUserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_user_canister(
            self.key.canister_id(),
            &user_canister::c2c_user_canister::Args {
                user_id: Some(self.key),
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
