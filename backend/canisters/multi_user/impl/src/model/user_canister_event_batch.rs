use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use std::collections::HashSet;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::info;
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::c2c_user_canister_v2::Event;
use user_core::event_recipient::{EventRecipient, lookup_event_recipient};
use utils::canister::{
    delay_if_should_retry_failed_c2c_call, delay_if_should_retry_failed_c2c_call_to_new_method,
    is_user_canister_possibly_migrated,
};

// The direct chat events from this canister's users for users in other canisters, batched per
// canister, so that those for every user a canister holds are sent to it together. They are always
// sent via `c2c_user_canister_v2`, since only it can name a sender other than the calling canister.
grouped_timer_job_batch!(UserCanisterEventBatch, CanisterId, IdempotentEnvelope<Event>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_user_canister_v2(
            self.key,
            &user_canister::c2c_user_canister_v2::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_user_canister_v2::Response::Success) => Ok(()),
            Err(error) => {
                // If the user has been migrated to a MultiUser canister, their events are sent on
                // to them there instead. Only a canister which holds a user alone is ever migrated.
                if is_user_canister_possibly_migrated(&error)
                    && self.items.iter().all(|event| event.value.recipient.index() == 0)
                {
                    match lookup_recipient(self.key.into()).await {
                        Ok(EventRecipient::Migrated(new_user_id)) => {
                            mutate_state(|state| {
                                state.data.migrated_user_ids.insert(self.key.into(), new_user_id);

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

                                // The senders may not have been told of the migration, eg. if their
                                // first message to the user was sent while the user was being
                                // migrated, so their chats are moved onto the new id now
                                let senders: HashSet<UserId> = pending.iter().map(|event| event.value.sender).collect();
                                for sender in senders {
                                    if let Some(sender_index) = state.index_of_local_user(sender) {
                                        state.data.users.with_user_mut(sender_index, |user| {
                                            user.migrate_their_user_id(self.key.into(), new_user_id, now)
                                        });
                                    }
                                }

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
                        // retried, including while the cycles refunder is installed, which is only
                        // briefly, and is otherwise the only time a User canister is missing the method
                        Ok(EventRecipient::User) => return Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
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

// What has become of the user, whose latest id is taken from the cache if they are known to have been
// migrated, and who is otherwise looked up from the LocalUserIndex and if need be the UserIndex. A
// migration which hasn't yet been heard of isn't found, so the events are retried as usual until it has.
async fn lookup_recipient(user_id: UserId) -> Result<EventRecipient, C2CError> {
    let (cached, local_user_index_canister_id, user_index_canister_id) = read_state(|state| {
        (
            state.data.migrated_user_ids.get(&user_id),
            state.data.local_user_index_canister_id,
            state.data.user_index_canister_id,
        )
    });
    if let Some(new_user_id) = cached {
        return Ok(EventRecipient::Migrated(new_user_id));
    }

    lookup_event_recipient(user_id, local_user_index_canister_id, user_index_canister_id).await
}
