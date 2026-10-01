use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use crate::{UserEvent, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::{
    delay_if_should_retry_failed_c2c_call, delay_if_should_retry_failed_c2c_call_to_new_method, is_out_of_cycles_error,
    is_user_canister_possibly_migrated,
};

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(UserEventBatch, CanisterId, IdempotentEnvelope<(UserId, UserEvent)>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let canister_id = self.key;

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if self.items.first().is_some_and(|event| event.value.0.index() != 0) {
            user_canister_c2c_client::c2c_local_user_index_v2(
                canister_id,
                &user_canister::c2c_local_user_index_v2::Args {
                    events: self.items.clone(),
                },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_local_user_index(
                canister_id,
                &user_canister::c2c_local_user_index::Args {
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
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(canister_id)).await;
                }
                // If the user has been migrated to a MultiUser canister, their events are sent on to
                // them there instead. Only a canister which holds a user alone is ever migrated.
                if self.items.iter().all(|event| event.value.0.index() == 0) {
                    let user_id: UserId = canister_id.into();
                    if mutate_state(|state| {
                        // Whatever the failure, since the user's old canister no longer serves them,
                        // eg. a batch sent while they were being switched over fails because their
                        // old canister is frozen
                        if state.data.migrated_user_ids.get(&user_id).is_none() {
                            return false;
                        }
                        // Any events queued for the old id since this batch was taken are moved too,
                        // after it, so that they stay in order
                        let events = self
                            .items
                            .iter()
                            .cloned()
                            .chain(state.data.user_events_queue.take(&canister_id))
                            .collect();
                        state.push_events_queued_for_migrated_user(user_id, events);
                        true
                    }) {
                        return Ok(());
                    }
                    // This LocalUserIndex is told of each of its users' migrations before closing out
                    // their old canisters, so if their canister looks to have been closed out, the
                    // events are retried until it has been told, as long as the user is still held
                    // here, rather than having been deleted
                    if is_user_canister_possibly_migrated(&error)
                        && read_state(|state| state.data.local_users.contains(&user_id))
                    {
                        return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error).or(Some(5 * MINUTE_IN_MS)));
                    }
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
