use crate::{RuntimeState, mutate_state, read_state};
use constants::{MINUTE_IN_MS, SECOND_IN_MS};
use daily_puzzle_canister::c2c_pull_puzzles::{Args, Response};
use std::time::Duration;
use tracing::{error, info};
use types::Milliseconds;
use utils::canister::delay_if_should_retry_failed_c2c_call;
use utils::canister_timers::run_now_then_interval;

// The daily canister pushes at the rollover, so this is the fallback for a push that never
// arrived: the canister was down or stopped over midnight, or this index was registered after the
// day's refresh. Without it that subnet holds yesterday's number until its next upgrade, and
// every call answers `Expired` for the rest of the day.
const CHECK_INTERVAL: Milliseconds = 15 * MINUTE_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CHECK_INTERVAL), run);
}

// Pulls straight away rather than waiting for the next tick, for when the canister id is first set
pub fn pull_now() {
    ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
}

fn run() {
    if read_state(is_required) {
        ic_cdk::futures::spawn_migratory(pull());
    }
}

fn is_required(state: &RuntimeState) -> bool {
    state.data.daily_puzzle_canister_id.is_some() && state.data.daily_puzzle_engine.is_stale(state.env.now())
}

async fn pull() {
    let Some(canister_id) = read_state(|state| state.data.daily_puzzle_canister_id) else {
        return;
    };

    match daily_puzzle_canister_c2c_client::c2c_pull_puzzles(canister_id, &Args {}).await {
        // An empty success is "I have nothing for the current number", which the daily canister
        // answers during the gap between `regenerate_today` dropping a puzzle and its replacement
        // being generated. `set_puzzles` ignores it rather than reading it as a day change.
        Ok(Response::Success(puzzles)) if puzzles.is_empty() => info!("No daily puzzles to pull"),
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
                ic_cdk_timers::set_timer(Duration::from_millis(30 * SECOND_IN_MS), async { run() });
            }
        }
    }
}
