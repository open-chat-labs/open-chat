use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use multi_user_canister::GroupCanisterEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::{
    delay_if_should_retry_failed_c2c_call, delay_if_should_retry_failed_c2c_call_to_new_method,
    is_user_canister_possibly_migrated,
};

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
            run_regular_jobs();
        }

        let canister_id = self.key;

        let response = multi_user_canister_c2c_client::c2c_group_canister_v2(
            canister_id,
            &multi_user_canister::c2c_group_canister_v2::Args::new(self.items.clone()),
        )
        .await;

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => {
                // If the user has been migrated to a MultiUser canister, their events are sent on
                // to them there instead. Only a user's old id, which was a User canister's id, can be one
                // they have been migrated from.
                if is_user_canister_possibly_migrated(&error) && self.items.iter().all(|event| event.value.0.index() == 0) {
                    match latest_id_if_migrated(canister_id.into()).await {
                        Ok(Some(new_user_id)) => {
                            mutate_state(|state| {
                                // Any events queued for the old id since this batch was taken are moved
                                // too, after it, so that they stay in order. All are stamped with the
                                // current time, since the MultiUser canister ignores any event from this
                                // canister older than the latest it has had from it, and these may have
                                // been created before events already sent to it.
                                let now = state.env.now();
                                let queue = &mut state.data.user_events_queue;
                                let events = self
                                    .items
                                    .iter()
                                    .cloned()
                                    .chain(queue.take(&canister_id))
                                    .map(|event| IdempotentEnvelope {
                                        created_at: now,
                                        idempotency_id: event.idempotency_id,
                                        value: (new_user_id, event.value.1),
                                    })
                                    .collect();
                                queue.push_many(new_user_id.canister_id(), events);
                            });
                            return Ok(());
                        }
                        // The LocalUserIndex may not have heard of the migration yet, so the events are
                        // retried, including while the cycles refunder, which lacks the method, is briefly
                        // installed in the old canister
                        Ok(None) => return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
                        // They may have been migrated, so the events are retried as the lookup would
                        // be, falling back to retrying them as the call to the old canister would be
                        Err(lookup_error) => {
                            return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&lookup_error)
                                .or_else(|| delay_if_should_retry_failed_c2c_call(&error)));
                        }
                    }
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}

// The user's latest id, if they have been migrated to a MultiUser canister since having `user_id`,
// looked up from the LocalUserIndex
async fn latest_id_if_migrated(user_id: UserId) -> Result<Option<UserId>, C2CError> {
    let local_user_index_canister_id = read_state(|state| state.data.local_user_index_canister_id);

    local_user_index_canister_c2c_client::lookup_migrated_user_id(user_id, local_user_index_canister_id).await
}
