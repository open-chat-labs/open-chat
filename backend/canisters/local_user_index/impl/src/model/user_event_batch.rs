use crate::UserEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds, QueuedUserEvent};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_out_of_cycles_error};

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(UserEventBatch, CanisterId, QueuedUserEvent<UserEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let canister_id = self.key;
        let events: Vec<_> = self
            .items
            .iter()
            .cloned()
            .map(|e| e.into_parts(canister_id))
            // TODO remove this filter once User canisters have been released
            .filter(|(_, e)| !matches!(e.value, UserEvent::BotUpdated(_)))
            .collect();

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if events.first().is_some_and(|(user_id, _)| user_id.index() != 0) {
            user_canister_c2c_client::c2c_local_user_index_v2(
                canister_id,
                &user_canister::c2c_local_user_index_v2::Args { events },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_local_user_index(
                canister_id,
                &user_canister::c2c_local_user_index::Args {
                    user_id: canister_id.into(),
                    events: events.into_iter().map(|(_, event)| event).collect(),
                },
            )
            .await
        };

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(canister_id)).await;
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
