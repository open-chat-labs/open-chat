use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::chit_leaderboard::{Response::*, *};

#[query]
fn chit_leaderboard(_args: Args) -> Response {
    read_state(chit_leaderboard_impl)
}

fn chit_leaderboard_impl(state: &RuntimeState) -> Response {
    Success(state.data.chit_leaderboard.get())
}
