use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::results::{Response::*, *};

const MAX_USER_IDS: usize = 200;

#[query(candid = true, msgpack = true)]
#[trace]
fn results(args: Args) -> Response {
    read_state(|state| results_impl(args, state))
}

fn results_impl(args: Args, state: &RuntimeState) -> Response {
    Success(
        args.user_ids
            .into_iter()
            .take(MAX_USER_IDS)
            .filter_map(|user_id| state.data.results.get(&(args.number, args.game_id.clone(), user_id)))
            .cloned()
            .collect(),
    )
}
