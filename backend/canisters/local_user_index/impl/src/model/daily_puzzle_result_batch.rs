use constants::MINUTE_IN_MS;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use tracing::error;
use types::{CanisterId, DailyPuzzleResult, Milliseconds, UnitResult};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(DailyPuzzleResultBatch, CanisterId, DailyPuzzleResult, 100);

// `c2c_report_results` refuses a caller the daily canister has not yet learnt from the registry,
// which is the state a newly added index is in until its next refresh
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;

impl TimerJobItem for DailyPuzzleResultBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = daily_puzzle_canister_c2c_client::c2c_report_results(
            self.state,
            &daily_puzzle_canister::c2c_report_results::Args {
                results: self.items.clone(),
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
            Err(error) => Err(delay_if_should_retry_failed_c2c_call(&error)),
        }
    }
}
