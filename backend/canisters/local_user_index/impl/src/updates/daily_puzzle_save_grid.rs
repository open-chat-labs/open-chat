use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_save_grid::*;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn daily_puzzle_save_grid(args: Args) -> Response {
    mutate_state(|state| daily_puzzle_save_grid_impl(args, state))
}

fn daily_puzzle_save_grid_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.calling_user_id();
    let now = state.env.now();
    state
        .data
        .daily_puzzle_engine
        .save_grid(user_id, &args.game_id, args.number, args.grid, now)
        .into()
}
