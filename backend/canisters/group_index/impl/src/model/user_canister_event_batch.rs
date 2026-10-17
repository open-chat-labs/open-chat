use multi_user_canister::GroupIndexEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(
    UserCanisterEventBatch,
    CanisterId,
    IdempotentEnvelope<(UserId, GroupIndexEvent)>,
    1000
);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = multi_user_canister_c2c_client::c2c_group_index(
            self.key,
            &multi_user_canister::c2c_group_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => Err(delay_if_should_retry_failed_c2c_call(&error)),
        }
    }
}
