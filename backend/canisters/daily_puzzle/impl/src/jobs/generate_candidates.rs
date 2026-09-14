//! Generates one candidate per timer callback so no single message runs the whole pool, and
//! re-arms itself while anything is still needed.

use crate::jobs::push_puzzle;
use crate::{GenerationFailure, MAX_GENERATION_FAILURES, RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};

/// Long enough that a run of failing attempts does not hold the canister's message queue, short
/// enough that the day still ships within minutes of the rollover.
const RETRY_DELAY: Duration = Duration::from_secs(5);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Not gated on `TIMER_ID` being empty. A trap inside `run` rolls back the `None` it wrote first,
// so the cell holds the id of a timer that has already fired; gating on it would make every call
// here a no-op until the next upgrade, with every operator lever dead. `schedule` clears whatever
// is held instead, so the worst case of calling this while a retry is pending is that the retry
// runs now.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if state.data.generation_needed(state.env.now()).is_some() {
        schedule(Duration::ZERO);
        true
    } else {
        false
    }
}

fn schedule(delay: Duration) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer(delay, async { run() });
    TIMER_ID.set(Some(timer_id));
}

fn run() {
    TIMER_ID.set(None);
    mutate_state(|state| {
        let now = state.env.now();
        if state.data.master_seed == 0 {
            // The rng has not been seeded yet. The reseed calls back here once it lands, and
            // re-issues itself if raw_rand rejected, so there is nothing to re-arm. Issued from a
            // fresh timer rather than inside this borrow of the state.
            ic_cdk_timers::set_timer(Duration::ZERO, async { crate::lifecycle::reseed_rng() });
            return;
        }
        let Some(number) = state.data.generation_needed(now) else {
            return;
        };
        let params = state.data.params_for(number);
        let start = ic_cdk::api::performance_counter(0);
        let index = match state.data.generate_candidate(number) {
            Ok(index) => index,
            // This seed found nothing. The next attempt is salted with the failure count, so it is
            // a different puzzle attempt rather than the one that just failed - without that, the
            // day is over: nothing else moves the seed, and the rollover timer would regenerate
            // from the identical seed twice a day until an operator noticed.
            Err(GenerationFailure::Exhausted) => {
                let again = state.data.record_generation_failure(number);
                let failures = state.data.failures_for(number);
                if again {
                    error!(number, game_id = params.game_id, failures, "Generation exhausted, retrying");
                    schedule(RETRY_DELAY);
                } else {
                    error!(
                        number,
                        game_id = params.game_id,
                        failures = MAX_GENERATION_FAILURES,
                        "Generation exhausted, giving up for this number"
                    );
                }
                return;
            }
            // The game has no generator, or its parameters are impossible: validation keeps both
            // out of the schedule, and no retry fixes either. Don't re-arm, or the job would spin.
            Err(GenerationFailure::Permanent) => {
                error!(number, game_id = params.game_id, "No candidate generated for scheduled game");
                return;
            }
        };
        let instructions = ic_cdk::api::performance_counter(0) - start;
        let hints = state.data.candidates[&number][&params.game_id][index as usize]
            .puzzle
            .hints
            .len();
        info!(
            number,
            game_id = params.game_id,
            index,
            width = params.width,
            height = params.height,
            tier = params.tier,
            hints,
            instructions,
            "Generated candidate"
        );
        if state.data.ensure_puzzles(now) {
            push_puzzle::schedule(true, Duration::ZERO);
        }
        start_job_if_required(state);
    });
}
