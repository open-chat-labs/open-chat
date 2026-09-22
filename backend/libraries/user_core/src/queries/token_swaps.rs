use crate::User;
use types::Timestamped;
use user_canister::token_swaps::{Args, SuccessResult, TokenSwap};

pub fn token_swaps(user: &User, args: Args) -> SuccessResult {
    let total = user.token_swaps.len() as u32;
    let swaps = user
        .token_swaps
        .page(args.start as usize, args.max_results as usize)
        .into_iter()
        .map(|s| TokenSwap {
            args: s.args.clone(),
            started: s.started,
            icrc2: s.icrc2,
            transfer_or_approval: extract_inner(&s.transfer_or_approval),
            notified_dex: extract_inner(&s.notified_dex_at),
            amount_swapped: map_inner(&s.swap_result, |r| r.map(|i| i.amount_out)),
            withdrawn_from_dex: extract_inner(&s.withdrawn_from_dex_at),
            success: s.success.as_ref().map(|v| v.value),
        })
        .collect();

    SuccessResult { total, swaps }
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
