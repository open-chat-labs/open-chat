use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, Milliseconds, UserId};
use user_canister::CommunityCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// The queue of events as held before they were batched per canister, which is drained after the
// upgrade and no longer pushed to
// TODO: Remove this once every queue has been drained
grouped_timer_job_batch!(LegacyUserEventBatch, UserId, IdempotentEnvelope<CommunityCanisterEvent>, 1000);

impl TimerJobItem for LegacyUserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_community_canister(
            self.key.canister_id(),
            &user_canister::c2c_community_canister::Args {
                user_id: self.key,
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_community_canister::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
