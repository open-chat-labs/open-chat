use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::UserCanisterEvent;
use utils::canister::{
    delay_if_should_retry_failed_c2c_call, delay_if_should_retry_failed_c2c_call_to_new_method,
    is_target_canister_uninstalled_or_deleted,
};

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
                // A User canister is uninstalled once its user has been migrated to a MultiUser
                // canister, so if they have been, their events are sent on to them there instead
                if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) {
                    match latest_id_if_migrated(canister_id.into()).await {
                        Ok(Some(new_user_id)) => {
                            mutate_state(|state| {
                                state.data.migrated_user_ids.insert(canister_id.into(), new_user_id);

                                // Any events queued for the old id since this batch was taken are moved
                                // too, after it, so that they stay in order. All are stamped with the
                                // current time, since the MultiUser canister ignores any event from this
                                // canister older than the latest it has had from it, and these may have
                                // been created before events already sent to it.
                                let now = state.env.now();
                                let queue = &mut state.data.user_canister_events_by_canister;
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
                        Ok(None) => {}
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
// taken from the cache if it is there and otherwise looked up from the LocalUserIndex. A migration
// the LocalUserIndex hasn't yet heard of isn't found, so the events are retried as usual until it has.
async fn latest_id_if_migrated(user_id: UserId) -> Result<Option<UserId>, C2CError> {
    let (cached, local_user_index_canister_id) = read_state(|state| {
        (
            state.data.migrated_user_ids.get(&user_id),
            state.data.local_user_index_canister_id,
        )
    });
    if cached.is_some() {
        return Ok(cached);
    }

    local_user_index_canister_c2c_client::lookup_migrated_user_id(user_id, local_user_index_canister_id).await
}
