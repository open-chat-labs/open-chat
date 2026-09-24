use crate::{mutate_state, read_state};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use user_canister::c2c_user_canister_v2::Event;
use utils::canister::{delay_if_should_retry_failed_c2c_call_to_new_method, is_target_canister_uninstalled_or_deleted};

// The direct chat events from this canister's users for users in other canisters, batched per
// canister, so that those for every user a canister holds are sent to it together. They are always
// sent via `c2c_user_canister_v2`, since only it can name a sender other than the calling canister.
grouped_timer_job_batch!(UserCanisterEventBatch, CanisterId, IdempotentEnvelope<Event>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
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
                // A User canister is uninstalled once its user has been migrated to a MultiUser
                // canister, so if they have been, their events are sent on to them there instead
                if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message())
                    && let Some(new_user_id) = latest_id_if_migrated(self.key.into()).await
                {
                    mutate_state(|state| {
                        state.data.migrated_user_ids.insert(self.key.into(), new_user_id);

                        // Any events queued for the old id since this batch was taken are moved
                        // too, after it, so that they stay in order. All are stamped with the
                        // current time, since the MultiUser canister ignores any event from this
                        // canister older than the latest it has had from it, and these may have
                        // been created before events already sent to it.
                        let now = state.env.now();
                        let queue = &mut state.data.user_canister_events_queue;
                        let events = self
                            .items
                            .iter()
                            .cloned()
                            .chain(queue.take(&self.key))
                            .map(|event| IdempotentEnvelope {
                                created_at: now,
                                idempotency_id: event.idempotency_id,
                                value: Event {
                                    recipient: new_user_id,
                                    ..event.value
                                },
                            })
                            .collect();
                        queue.push_many(new_user_id.canister_id(), events);
                    });
                    return Ok(());
                }
                // Keep retrying if the recipient's User canister hasn't yet been upgraded to a version
                // with `c2c_user_canister_v2`
                // TODO revert to `delay_if_should_retry_failed_c2c_call` once every User canister has it
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call_to_new_method(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}

// The user's latest id, if they have been migrated to a MultiUser canister since having `user_id`,
// taken from the cache if it is there and otherwise looked up from the LocalUserIndex. A migration
// the LocalUserIndex hasn't yet heard of isn't found, so the events are retried as usual until it has.
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

    local_user_index_canister_c2c_client::lookup_migrated_user_id(user_id, local_user_index_canister_id)
        .await
        .ok()
        .flatten()
}
