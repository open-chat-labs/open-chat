use constants::MINUTE_IN_MS;
use daily_puzzle_canister::LocalIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use tracing::error;
use types::{CanisterId, IdempotentEnvelope, Milliseconds, UnitResult};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(DailyPuzzleEventBatch, CanisterId, IdempotentEnvelope<LocalIndexEvent>, 100);

// `c2c_local_index` refuses a caller the daily canister has not yet learnt from the registry, which
// is the state a newly added index is in until its next refresh
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;

impl TimerJobItem for DailyPuzzleEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = daily_puzzle_canister_c2c_client::c2c_local_index(
            self.state,
            &daily_puzzle_canister::c2c_local_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(UnitResult::Success) => Ok(()),
            Ok(UnitResult::Error(error)) => {
                // The only error it returns is the caller check, and that clears once the daily
                // canister refreshes the registry. Dropping the batch instead loses those solves
                // for good: nothing else holds them, so the users' cards can never be verified and
                // the published medians are computed without them.
                error!(?error, count = self.items.len(), "Daily puzzle results rejected, retrying");
                Err(Some(RETRY_DELAY))
            }
            // A daily canister not yet upgraded to take these is retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
