use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::swap_tokens::*;

// Users hold their own funds, which this canister can't spend, so they make their swaps themselves,
// straight from their wallets, which this canister only records (see `mark_token_swap_started`)
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn swap_tokens(_args: Args) -> Response {
    Response::Error(
        OCErrorCode::InvalidRequest.with_message("Users of the MultiUser canister swap straight from their own wallets"),
    )
}
