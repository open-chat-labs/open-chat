use crate::guards::caller_is_daily_puzzle_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_daily_puzzle_push::*;
use tracing::info;

#[update(guard = "caller_is_daily_puzzle_canister", msgpack = true)]
#[trace]
fn c2c_daily_puzzle_push(args: Args) -> Response {
    mutate_state(|state| c2c_daily_puzzle_push_impl(args, state))
}

fn c2c_daily_puzzle_push_impl(args: Args, state: &mut RuntimeState) -> Response {
    let records_dropped = state.data.daily_puzzle_engine.set_puzzles(args.puzzles);
    let metrics = state.data.daily_puzzle_engine.metrics();
    info!(
        number = ?metrics.number,
        games = ?metrics.games,
        enabled = metrics.enabled,
        records_dropped,
        "Daily puzzles received"
    );
    Response::Success
}
