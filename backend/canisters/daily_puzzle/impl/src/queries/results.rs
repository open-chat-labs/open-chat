use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::results::{Response::*, *};
use types::UserId;

const MAX_USER_IDS: usize = 200;

#[query(candid = true, msgpack = true)]
#[trace]
fn results(args: Args) -> Response {
    read_state(|state| results_impl(args, state))
}

fn results_impl(args: Args, state: &RuntimeState) -> Response {
    let Args {
        number,
        game_id,
        user_ids,
    } = args;
    // One key, with the user id swapped for each lookup: cloning the game id per id is 200 string
    // allocations for a key that never changes
    let mut key = (number, game_id, UserId::from(Principal::from_slice(&[])));
    Success(
        user_ids
            .into_iter()
            .take(MAX_USER_IDS)
            .filter_map(|user_id| {
                key.2 = user_id;
                state.data.results.get(&key).cloned()
            })
            .collect(),
    )
}
