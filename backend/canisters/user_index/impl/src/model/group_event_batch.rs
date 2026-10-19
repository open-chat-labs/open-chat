use constants::DAY_IN_MS;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::error;
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::{delay_if_should_retry_failed_c2c_call_to_new_method, is_target_canister_uninstalled_or_deleted};

// Batched per group, in the order they were pushed
grouped_timer_job_batch!(
    GroupEventBatch,
    CanisterId,
    IdempotentEnvelope<group_canister::UserIndexEvent>,
    1000
);

const MAX_RETRY_AGE: Milliseconds = 7 * DAY_IN_MS;

impl TimerJobItem for GroupEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = group_canister_c2c_client::c2c_user_index(
            self.key,
            &group_canister::c2c_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // A deleted group's canister is left uninstalled, so the events could never be delivered
            Err(error) if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) => Err(None),
            // A receiver not yet upgraded to take these is retried until it has been. A group
            // uninstalled once it ran out of cycles rejects calls as being out of cycles rather than
            // as uninstalled, so its events are dropped once they have been failing for a week.
            Err(error) => {
                let oldest = self.items.first().map_or(0, |e| e.created_at);
                if canister_time::now_millis().saturating_sub(oldest) > MAX_RETRY_AGE {
                    error!(canister_id = %self.key, ?error, count = self.items.len(), "Dropping events which have failed for a week");
                    Err(None)
                } else {
                    Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error))
                }
            }
        }
    }
}
