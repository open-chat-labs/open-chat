use crate::guards::caller_is_local_user_index;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_withdraw_from_icpswap::*;

// There's nothing to withdraw while token swaps aren't supported
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_withdraw_from_icpswap(_args: Args) -> Response {
    Response::Error(OCErrorCode::InvalidRequest.with_message("Token swaps are not yet supported by the MultiUser canister"))
}
