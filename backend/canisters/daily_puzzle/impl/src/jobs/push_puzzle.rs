//! Delivers the current day's puzzles to every local user index. A refresh re-reads the set from
//! the registry and targets all of them; failures stay in `pending_pushes` and retry every 60s.

use crate::{RuntimeState, mutate_state, read_state, registry};
use ic_cdk_timers::TimerId;
use local_user_index_canister::c2c_daily_puzzle_push;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::UnitResult;

const RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_pushes.is_empty() {
        schedule(false, Duration::ZERO);
        true
    } else {
        false
    }
}

pub(crate) fn schedule(refresh: bool, delay: Duration) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer(delay, async move { run(refresh) });
    TIMER_ID.set(Some(timer_id));
}

fn run(refresh: bool) {
    TIMER_ID.set(None);
    ic_cdk::futures::spawn_migratory(push(refresh));
}

async fn push(refresh: bool) {
    if refresh {
        if let Err(error) = registry::refresh_local_user_indexes().await {
            error!(?error, "Failed to refresh local user indexes from the registry");
            if read_state(|state| state.data.local_user_indexes.is_empty()) {
                schedule(true, RETRY_DELAY);
                return;
            }
        }
        mutate_state(|state| state.data.pending_pushes = state.data.local_user_indexes.clone());
    }

    let (puzzles, targets) = read_state(|state| {
        (
            state
                .data
                .current_puzzles(state.env.now())
                .into_iter()
                .cloned()
                .collect::<Vec<_>>(),
            state.data.pending_pushes.iter().copied().collect::<Vec<_>>(),
        )
    });
    if puzzles.is_empty() {
        // Nothing for the current number: the gap between `regenerate_today` dropping today's
        // puzzle and its replacement being generated. Indexes still owed a push keep their place
        // in the queue - clearing it forgets the ones that never received the last puzzle, and the
        // refresh push that follows the replacement is the only thing that would have put them
        // back.
        if !targets.is_empty() {
            schedule(false, RETRY_DELAY);
        }
        return;
    }
    let number = puzzles[0].number;
    let games = puzzles.len();

    // All at once, not one after another: the calls are independent, and awaiting each in turn
    // puts the day's puzzle on the last subnet several seconds' worth of round trips after the
    // first, with one stopped index holding up every index behind it.
    let futures: Vec<_> = targets
        .into_iter()
        .map(|canister_id| {
            let args = c2c_daily_puzzle_push::Args {
                puzzles: puzzles.clone(),
            };
            async move {
                (
                    canister_id,
                    local_user_index_canister_c2c_client::c2c_daily_puzzle_push(canister_id, &args).await,
                )
            }
        })
        .collect();

    for (canister_id, response) in futures::future::join_all(futures).await {
        match response {
            Ok(UnitResult::Success) => {
                mutate_state(|state| state.data.pending_pushes.remove(&canister_id));
                info!(%canister_id, number, games, "Pushed puzzles");
            }
            Ok(UnitResult::Error(error)) => error!(%canister_id, ?error, "Local user index rejected puzzles"),
            Err(error) => error!(%canister_id, ?error, "Failed to push puzzles"),
        }
    }

    if read_state(|state| !state.data.pending_pushes.is_empty()) {
        schedule(false, RETRY_DELAY);
    }
}
