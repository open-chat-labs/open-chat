use crate::guards::caller_is_local_user_index;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_withdraw_from_icpswap::*;

// Not yet supported. A swap's output is withdrawn into this canister's subaccount for the user, and
// would then have to be sent on to their wallet, as `swap_tokens` does.
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_withdraw_from_icpswap(_args: Args) -> Response {
    Response::Error(
        OCErrorCode::InvalidRequest.with_message("Withdrawing from ICPSwap is not yet supported by the MultiUser canister"),
    )
}
