use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::chit_leaderboard::{Response::*, *};

#[query(candid = true, json = true)]
fn chit_leaderboard(_args: Args) -> Response {
    read_state(chit_leaderboard_impl)
}

fn chit_leaderboard_impl(state: &RuntimeState) -> Response {
    let results = state
        .data
        .chit_leaderboard
        .get()
        .into_iter()
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
        .collect();

    Success(results)
}
