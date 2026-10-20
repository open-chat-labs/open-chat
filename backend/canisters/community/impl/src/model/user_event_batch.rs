use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use multi_user_canister::CommunityCanisterEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::info;
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_index_canister_c2c_client::{EventRecipient, lookup_event_recipient};
use utils::canister::{delay_if_should_retry_failed_c2c_call_to_new_method, is_user_canister_possibly_migrated};

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(
    UserEventBatch,
    CanisterId,
    IdempotentEnvelope<(UserId, CommunityCanisterEvent)>,
    1000
);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let canister_id = self.key;

        let response = multi_user_canister_c2c_client::c2c_community(
            canister_id,
            &multi_user_canister::c2c_community::Args::new(self.items.clone()),
        )
        .await;

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => {
                // If the user has been migrated to a MultiUser canister, their events are sent on
                // to them there instead. Only a user's old id, which was a User canister's id, can be one
                // they have been migrated from.
                if is_user_canister_possibly_migrated(&error) && self.items.iter().all(|event| event.value.0.index() == 0) {
                    let user_id: UserId = canister_id.into();
                    match lookup_recipient(user_id).await {
                        Ok(EventRecipient::Migrated(new_user_id)) => {
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
                        // The user has deleted their account, so the events can never be delivered.
                        // They are dropped, along with any queued for the user since, and the user is
                        // removed from the community, which may never have been told of the deletion and
                        // would otherwise go on queueing events for them.
                        Ok(EventRecipient::Gone) => {
                            mutate_state(|state| {
                                state.data.user_events_queue.take(&canister_id);
                                let now = state.env.now();
                                if state.data.remove_deleted_user_unless_bot(user_id, now) {
                                    info!(%user_id, "Removed a member whose account has been deleted");
                                }
                            });
                            return Ok(());
                        }
                        // The indexes may not have heard of the migration yet, so the events are
                        // retried, including while the cycles refunder, which lacks the method, is briefly
                        // installed in the old canister
                        Ok(EventRecipient::User) => return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
                        // They may have been migrated, so the events are retried as the lookup would
                        // be, falling back to retrying them as the call to the old canister would be
                        Err(lookup_error) => {
                            return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&lookup_error)
                                .or_else(|| delay_if_should_retry_failed_c2c_call_to_new_method(&error)));
                        }
                    }
                }
                // A MultiUser canister not yet upgraded to take these is retried until it has been
                Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error))
            }
        }
    }
}

// What has become of the user with the old id `user_id`, looked up from the LocalUserIndex, then the
// UserIndex
async fn lookup_recipient(user_id: UserId) -> Result<EventRecipient, C2CError> {
    let (local_user_index_canister_id, user_index_canister_id) =
        read_state(|state| (state.data.local_user_index_canister_id, state.data.user_index_canister_id));

    lookup_event_recipient(user_id, local_user_index_canister_id, user_index_canister_id).await
}
