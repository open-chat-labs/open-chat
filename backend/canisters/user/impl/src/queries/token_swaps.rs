use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use types::Timestamped;
use user_canister::token_swaps::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn token_swaps(args: Args) -> Response {
    read_state(|state| token_swaps_impl(args, state))
}

fn token_swaps_impl(args: Args, state: &RuntimeState) -> Response {
    let total = state.data.token_swaps.len() as u32;
    let swaps = state
        .data
        .token_swaps
        .iter()
        .skip(args.start as usize)
        .take(args.max_results as usize)
        .map(|s| TokenSwap {
            args: s.args.clone(),
            started: s.started,
            transfer: map_inner(&s.transfer),
            notified_dex: map_inner(&s.notified_dex_at),
            amount_swapped: map_inner(&s.amount_swapped),
            withdrawn_from_dex: map_inner(&s.withdrawn_from_dex_at),
            success: s.success.as_ref().map(|v| v.value),
        })
        .collect();

    Success(SuccessResult { total, swaps })
}

fn map_inner<T: Clone>(value: &Option<Timestamped<Result<T, String>>>) -> Option<Result<T, String>> {
    value.as_ref().map(|v| v.value.clone())
}
