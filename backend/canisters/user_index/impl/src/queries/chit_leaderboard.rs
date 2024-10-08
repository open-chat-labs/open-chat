use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::chit_leaderboard::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn chit_leaderboard(_args: Args) -> Response {
    read_state(chit_leaderboard_impl)
}

fn chit_leaderboard_impl(state: &RuntimeState) -> Response {
    SuccessV2(SuccessResult {
        all_time: map_leaderboard(state.data.chit_leaderboard.all_time(), state),
        this_month: map_leaderboard(state.data.chit_leaderboard.this_month(), state),
        last_month: map_leaderboard(state.data.chit_leaderboard.last_month(), state),
    })
}

fn map_leaderboard(
    leaderboard: &[crate::model::chit_leaderboard::ChitUserBalance],
    state: &RuntimeState,
) -> Vec<ChitUserBalance> {
    leaderboard
        .iter()
        .map(|u| ChitUserBalance {
            user_id: u.user_id,
            username: state
                .data
                .users
                .get_by_user_id(&u.user_id)
                .map(|u| u.username.clone())
                .unwrap_or_default(),
            balance: u.balance,
        })
        .collect()
}
