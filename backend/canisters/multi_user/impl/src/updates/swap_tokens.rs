use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::swap_tokens::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn swap_tokens(_args: Args) -> Response {
    Response::Error(OCErrorCode::InvalidRequest.with_message("Token swaps are not yet supported by the MultiUser canister"))
}
