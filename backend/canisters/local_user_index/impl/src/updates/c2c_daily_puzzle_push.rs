use crate::guards::caller_is_daily_puzzle_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::c2c_daily_puzzle_push::*;
use tracing::info;

// No `#[trace]`: the args carry the solution and the full hint chain, and the trace buffer is
// served unguarded wherever `test_mode` is on.
#[update(guard = "caller_is_daily_puzzle_canister", msgpack = true)]
fn c2c_daily_puzzle_push(args: Args) -> Response {
    mutate_state(|state| c2c_daily_puzzle_push_impl(args, state))
}

fn c2c_daily_puzzle_push_impl(args: Args, state: &mut RuntimeState) -> Response {
    let records_dropped = state.data.daily_puzzle_engine.set_puzzles(args.puzzles);
    let summary = state.data.daily_puzzle_engine.summary();
    info!(
        number = ?summary.number,
        games = ?summary.games,
        enabled = summary.enabled,
        records_dropped,
        "Daily puzzles received"
    );
    Response::Success
}
