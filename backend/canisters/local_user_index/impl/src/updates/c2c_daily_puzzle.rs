use crate::guards::caller_is_daily_puzzle_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::DailyPuzzleEvent;
use local_user_index_canister::c2c_daily_puzzle::*;
use tracing::info;
use types::{DailyPuzzle, SuccessOnly};

// Must be fed by a single queue on the DailyPuzzle canister: the idempotency check keeps one
// high-water mark per sender, so a batch retried from a second queue after a later batch from the
// first had landed would be dropped as already seen. That also means a day's puzzles sent again late
// can't replace the next day's.
// No `#[trace]`: the events carry the solution and the full hint chain, and the trace buffer is
// served unguarded wherever `test_mode` is on.
#[update(guard = "caller_is_daily_puzzle_canister", msgpack = true)]
fn c2c_daily_puzzle(args: Args) -> Response {
    mutate_state(|state| c2c_daily_puzzle_impl(args, state))
}

fn c2c_daily_puzzle_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            match event.value {
                DailyPuzzleEvent::Puzzles(puzzles) => set_puzzles(puzzles, state),
            }
        }
    }
    SuccessOnly::Success
}

fn set_puzzles(puzzles: Vec<DailyPuzzle>, state: &mut RuntimeState) {
    let records_dropped = state.data.daily_puzzle_engine.set_puzzles(puzzles);
    let summary = state.data.daily_puzzle_engine.summary();
    info!(
        number = ?summary.number,
        games = ?summary.games,
        enabled = summary.enabled,
        records_dropped,
        "Daily puzzles received"
    );
}
