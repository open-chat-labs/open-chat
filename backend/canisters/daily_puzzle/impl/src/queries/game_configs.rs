use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use daily_puzzle_canister::game_configs::{Response::*, *};

#[query(candid = true, msgpack = true)]
#[trace]
fn game_configs(_args: Args) -> Response {
    read_state(|state| {
        Success(
            state
                .data
                .game_configs
                .iter()
                .map(|(game_id, config)| (game_id.clone(), config.clone()))
                .collect(),
        )
    })
}
