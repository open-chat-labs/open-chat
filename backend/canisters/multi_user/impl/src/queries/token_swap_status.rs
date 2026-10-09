use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use user_canister::token_swap_status::{Response::*, *};
use user_core::TokenSwap;

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn token_swap_status(args: Args) -> Response {
    match read_state(|state| state.with_caller_user(|_, user| user.token_swaps.get(args.swap_id))) {
        Some(swap) => Success(status(swap)),
        None => Error(OCErrorCode::SwapNotFound.into()),
    }
}

// The output (or a refund) is withdrawn from the DEX into this canister's subaccount for the user and
// only reaches their wallet once sent on from there, at which point the swap is finished. Until then
// it is reported as still being withdrawn, so that a client waits for the funds to be in the wallet.
fn status(swap: TokenSwap) -> TokenSwapStatus {
    let finished = swap.success.is_some();
    let mut status = TokenSwapStatus::from(swap);
    if !finished {
        status.withdraw_from_dex = None;
    }
    status
}
