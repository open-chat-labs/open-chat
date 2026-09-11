//! Generates one candidate per timer callback so no single message runs the whole pool, and
//! re-arms itself while anything is still needed.

use crate::jobs::push_puzzle;
use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.generation_needed(state.env.now()).is_some() {
        schedule(Duration::ZERO);
        true
    } else {
        false
    }
}

fn schedule(delay: Duration) {
    let timer_id = ic_cdk_timers::set_timer(delay, async { run() });
    TIMER_ID.set(Some(timer_id));
}

fn run() {
    TIMER_ID.set(None);
    mutate_state(|state| {
        let now = state.env.now();
        if state.data.master_seed == 0 {
            // The rng hasn't been seeded yet; try again shortly
            schedule(Duration::from_secs(1));
            return;
        }
        let Some(number) = state.data.generation_needed(now) else {
            return;
        };
        let params = state.data.params_for(number).clone();
        let start = ic_cdk::api::performance_counter(0);
        let Some(index) = state.data.generate_candidate(number) else {
            // Either the game has no generator, which validation keeps out of the schedule, or
            // generation failed and logged why. Don't re-arm, or the job would spin.
            error!(number, game_id = params.game_id, "No candidate generated for scheduled game");
            return;
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
