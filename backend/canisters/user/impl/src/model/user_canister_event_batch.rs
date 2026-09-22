use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::UserCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together. Each event is paired with the user it is for.
grouped_timer_job_batch!(
    UserCanisterEventBatch,
    CanisterId,
    IdempotentEnvelope<(UserId, UserCanisterEvent)>,
    100
);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let canister_id = self.key;

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call, which names this canister's user as the sender. A User canister is sent its
        // user's events via the original endpoint, so that this doesn't depend on every User
        // canister having been upgraded to support the new one.
        let response = if self.items.first().is_some_and(|event| event.value.0.index() != 0) {
            let my_user_id: UserId = ic_cdk::api::canister_self().into();
            user_canister_c2c_client::c2c_user_canister_v2(
                canister_id,
                &user_canister::c2c_user_canister_v2::Args {
                    events: self
                        .items
                        .iter()
                        .map(|event| IdempotentEnvelope {
                            created_at: event.created_at,
                            idempotency_id: event.idempotency_id,
                            value: user_canister::c2c_user_canister_v2::Event {
                                sender: my_user_id,
                                recipient: event.value.0,
                                event: event.value.1.clone(),
                            },
                        })
                        .collect(),
                },
            )
            .await
            .map(|_| ())
        } else {
            user_canister_c2c_client::c2c_user_canister(
                canister_id,
                &user_canister::c2c_user_canister::Args {
                    user_id: Some(canister_id.into()),
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
            .map(|_| ())
        };

        match response {
            Ok(()) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
