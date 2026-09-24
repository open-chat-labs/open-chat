use crate::{can_borrow_state, mutate_state, read_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::CommunityCanisterEvent;
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_target_canister_uninstalled_or_deleted};

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

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if self.items.first().is_some_and(|event| event.value.0.index() != 0) {
            user_canister_c2c_client::c2c_community_canister_v2(
                canister_id,
                &user_canister::c2c_community_canister_v2::Args {
                    events: self.items.clone(),
                },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_community_canister(
                canister_id,
                &user_canister::c2c_community_canister::Args {
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
                // A User canister is uninstalled once its user has been migrated to a MultiUser
                // canister, so if they have been, their events are sent on to them there instead
                if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message())
                    && let Some(new_user_id) = latest_id_if_migrated(canister_id.into()).await
                {
                    mutate_state(|state| {
                        state.data.user_events_queue.push_many(
                            new_user_id.canister_id(),
                            self.items
                                .iter()
                                .map(|event| IdempotentEnvelope {
                                    created_at: event.created_at,
                                    idempotency_id: event.idempotency_id,
                                    value: (new_user_id, event.value.1.clone()),
                                })
                                .collect(),
                        )
                    });
                    return Ok(());
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}

// The user's latest id, if they have been migrated to a MultiUser canister since having `user_id`.
// Looked up from the LocalUserIndex unless already cached, and cached if found. A migration the
// LocalUserIndex hasn't yet heard of isn't found, so the events are retried as usual until it has.
async fn latest_id_if_migrated(user_id: UserId) -> Option<UserId> {
    let (cached, local_user_index_canister_id) = read_state(|state| {
        (
            state.data.migrated_user_ids.get(&user_id),
            state.data.local_user_index_canister_id,
        )
    });
    if cached.is_some() {
        return cached;
    }

    let new_user_id = local_user_index_canister_c2c_client::lookup_migrated_user_id(user_id, local_user_index_canister_id)
        .await
        .ok()
        .flatten()?;

    mutate_state(|state| state.data.migrated_user_ids.insert(user_id, new_user_id));
    Some(new_user_id)
}
