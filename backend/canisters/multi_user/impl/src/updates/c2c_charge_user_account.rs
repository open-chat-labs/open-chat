use crate::guards::caller_is_user_index;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_charge_user_account::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_charge_user_account(args: Args) -> Response {
    let (user_index_canister_id, is_local_user) = read_state(|state| {
        (
            state.data.user_index_canister_id,
            state.index_of_local_user(args.user_id).is_some(),
        )
    });

    // Charging a user held elsewhere would debit whichever of our own users shares their index, so
    // refuse rather than take somebody else's funds
    if !is_local_user {
        return Error(OCErrorCode::InvalidRequest.with_message(format!("{} is not held by this canister", args.user_id)));
    }

    user_core::updates::c2c_charge_user_account(args, user_index_canister_id).await
}
