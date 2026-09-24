use crate::{can_borrow_state, mutate_state};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::GroupCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(
    UserEventBatch,
    CanisterId,
    IdempotentEnvelope<(UserId, GroupCanisterEvent)>,
    1000
);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            mutate_state(|state| state.run_regular_jobs());
        }

        let canister_id = self.key;

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if self.items.first().is_some_and(|event| event.value.0.index() != 0) {
            user_canister_c2c_client::c2c_group_canister_v2(
                canister_id,
                &user_canister::c2c_group_canister_v2::Args {
                    events: self.items.clone(),
                },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_group_canister(
                canister_id,
                &user_canister::c2c_group_canister::Args {
                    user_id: canister_id.into(),
                    events: self
                        .items
                        .iter()
                        .map(|event| IdempotentEnvelope {
                            created_at: event.created_at,
                            idempotency_id: event.idempotency_id,
                            value: event.value.1.clone(),
                        })
                        .collect(),
                },
            )
            .await
        };

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
