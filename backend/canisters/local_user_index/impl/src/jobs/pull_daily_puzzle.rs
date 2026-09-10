use crate::{RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use daily_puzzle_canister::c2c_pull_puzzles::{Args, Response};
use std::time::Duration;
use tracing::{error, info};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Pulls today's puzzles from the daily_puzzle canister. Used when the canister id is set and
// after an upgrade, in case a push was missed. Pushes cover the normal rollover.
pub fn start_job_if_required(state: &RuntimeState) {
    if state.data.daily_puzzle_canister_id.is_some() && state.data.daily_puzzle_engine.is_stale(state.env.now()) {
        start_job();
    }
}

pub fn start_job() {
    ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
}

fn run() {
    ic_cdk::futures::spawn_migratory(pull());
}

async fn pull() {
    let Some(canister_id) = read_state(|state| state.data.daily_puzzle_canister_id) else {
        return;
    };

    match daily_puzzle_canister_c2c_client::c2c_pull_puzzles(canister_id, &Args {}).await {
        Ok(Response::Success(puzzles)) => mutate_state(|state| {
            let records_dropped = state.data.daily_puzzle_engine.set_puzzles(puzzles);
            let metrics = state.data.daily_puzzle_engine.metrics();
            info!(
                number = ?metrics.number,
                games = ?metrics.games,
                enabled = metrics.enabled,
                records_dropped,
                "Daily puzzles pulled"
            );
        }),
        Ok(Response::Error(error)) => info!(?error, "No daily puzzles to pull"),
        Err(error) => {
            error!(?error, "Failed to pull daily puzzles");
            if delay_if_should_retry_failed_c2c_call(&error).is_some() {
                ic_cdk_timers::set_timer(Duration::from_millis(MINUTE_IN_MS), async { run() });
            }
        }
    }
}
