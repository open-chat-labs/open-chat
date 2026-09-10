use timer_job_queues::{TimerJobItem, timer_job_batch};
use tracing::error;
use types::{CanisterId, DailyPuzzleResult, Milliseconds, UnitResult};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(DailyPuzzleResultBatch, CanisterId, DailyPuzzleResult, 100);

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
                // The daily canister rejected the batch (eg. too old): retrying cannot help
                error!(?error, count = self.items.len(), "Daily puzzle results rejected");
                Ok(())
            }
            Err(error) => Err(delay_if_should_retry_failed_c2c_call(&error)),
        }
    }
}
