use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use multi_user_canister::c2c_user::Event;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::info;
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_core::event_recipient::{EventRecipient, lookup_event_recipient};
use utils::canister::{delay_if_should_retry_failed_c2c_call_to_new_method, is_user_canister_possibly_migrated};

// The direct chat events from this canister's users for users in other canisters, batched per
// canister, so that those for every user a canister holds are sent to it together. They are always
// sent via `c2c_user`, since only it can name a sender other than the calling canister.
grouped_timer_job_batch!(UserCanisterEventBatch, CanisterId, IdempotentEnvelope<Event>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = multi_user_canister_c2c_client::c2c_user(
            self.key,
            &multi_user_canister::c2c_user::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(multi_user_canister::c2c_user::Response::Success) => Ok(()),
            Err(error) => {
                // If the user has been migrated to a MultiUser canister, their events are sent on
                // to them there instead. Only a user's old id, which was a User canister's id, can be one
                // they have been migrated from.
                if is_user_canister_possibly_migrated(&error)
                    && self.items.iter().all(|event| event.value.recipient.index() == 0)
                {
                    match lookup_recipient(self.key.into()).await {
                        Ok(EventRecipient::Migrated(new_user_id)) => {
                            mutate_state(|state| {
                                // Any events queued for the old id since this batch was taken are moved
                                // too, after it, so that they stay in order. All are stamped with the
                                // current time, since the MultiUser canister ignores any event from this
                                // canister older than the latest it has had from it, and these may have
                                // been created before events already sent to it.
                                let now = state.env.now();
                                let pending: Vec<_> = self
                                    .items
                                    .iter()
                                    .cloned()
                                    .chain(state.data.user_canister_events_queue.take(&self.key))
                                    .collect();

                                let events = pending
                                    .into_iter()
                                    .map(|event| IdempotentEnvelope {
                                        created_at: now,
                                        idempotency_id: event.idempotency_id,
                                        value: Event {
                                            recipient: new_user_id,
                                            ..event.value
                                        },
                                    })
                                    .collect();
                                state
                                    .data
                                    .user_canister_events_queue
                                    .push_many(new_user_id.canister_id(), events);
                            });
                            return Ok(());
                        }
                        // The events can never be delivered, eg. to a user who has deleted their account,
                        // and would otherwise be retried forever
                        Ok(EventRecipient::Gone) => {
                            // As are any events queued for them since this batch was taken
                            let dropped = mutate_state(|state| state.data.user_canister_events_queue.take(&self.key));
                            let count = self.items.len() + dropped.len();
                            info!(canister_id = %self.key, count, "Dropped events for a user who is gone");
                            return Ok(());
                        }
                        // The LocalUserIndex may not have heard of the migration yet, so the events are
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

// What has become of the user, looked up from the LocalUserIndex and if need be the UserIndex
async fn lookup_recipient(user_id: UserId) -> Result<EventRecipient, C2CError> {
    let (local_user_index_canister_id, user_index_canister_id) =
        read_state(|state| (state.data.local_user_index_canister_id, state.data.user_index_canister_id));

    lookup_event_recipient(user_id, local_user_index_canister_id, user_index_canister_id).await
}
