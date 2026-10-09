use crate::guards::caller_is_local_user_index;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_withdraw_from_icpswap::*;

// There's nothing to withdraw, since users swap straight from their own wallets, so anything left
// with ICPSwap is held under the user's principal, which only they can withdraw
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_withdraw_from_icpswap(_args: Args) -> Response {
    Response::Error(
        OCErrorCode::InvalidRequest.with_message("Users of the MultiUser canister swap straight from their own wallets"),
    )
}
