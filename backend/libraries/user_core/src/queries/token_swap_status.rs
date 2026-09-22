use crate::User;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::token_swap_status::{Args, TokenSwapStatus};

pub fn token_swap_status(user: &User, args: Args) -> OCResult<TokenSwapStatus> {
    user.token_swaps
        .get(args.swap_id)
        .map(|token_swap| token_swap.into())
        .ok_or_else(|| OCErrorCode::SwapNotFound.into())
}
