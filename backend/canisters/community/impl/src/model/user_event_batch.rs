use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds, QueuedUserEvent};
use user_canister::CommunityCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(UserEventBatch, CanisterId, QueuedUserEvent<CommunityCanisterEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let canister_id = self.key;
        let events: Vec<_> = self.items.iter().cloned().map(|e| e.into_parts(canister_id)).collect();

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if events.first().is_some_and(|(user_id, _)| user_id.index() != 0) {
            user_canister_c2c_client::c2c_community_canister_v2(
                canister_id,
                &user_canister::c2c_community_canister_v2::Args { events },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_community_canister(
                canister_id,
                &user_canister::c2c_community_canister::Args {
                    user_id: canister_id.into(),
                    events: events.into_iter().map(|(_, event)| event).collect(),
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
