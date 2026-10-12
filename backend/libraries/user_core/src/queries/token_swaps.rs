use crate::User;
use user_canister::token_swaps::{Args, SuccessResult};

pub fn token_swaps(user: &User, args: Args) -> SuccessResult {
    let total = user.token_swaps.len() as u32;
    let swaps = user
        .token_swaps
        .page(args.start as usize, args.max_results as usize)
        .into_iter()
        .map(|s| s.into())
        .collect();

    SuccessResult { total, swaps }
}
