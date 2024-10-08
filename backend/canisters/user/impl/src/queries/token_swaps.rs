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
            icrc2: s.icrc2,
            transfer_or_approval: extract_inner(&s.transfer_or_approval),
            notified_dex: extract_inner(&s.notified_dex_at),
            amount_swapped: map_inner(&s.swap_result, |r| r.clone().map(|i| i.amount_out)),
            withdrawn_from_dex: extract_inner(&s.withdrawn_from_dex_at),
            success: s.success.as_ref().map(|v| v.value),
        })
        .collect();

    Success(SuccessResult { total, swaps })
}

fn extract_inner<T: Clone>(value: &Option<Timestamped<Result<T, String>>>) -> Option<Result<T, String>> {
    value.as_ref().map(|v| v.value.clone())
}

fn map_inner<I: Clone, O, F: FnOnce(I) -> O>(
    value: &Option<Timestamped<Result<I, String>>>,
    f: F,
) -> Option<Result<O, String>> {
    value.as_ref().map(|v| v.value.clone().map(f))
}
