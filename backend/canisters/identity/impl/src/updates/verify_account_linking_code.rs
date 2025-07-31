use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::verify_account_linking_code::{Args, Response};
use oc_error_codes::OCErrorCode;

#[update(msgpack = true, candid = true)]
#[trace]
fn verify_account_linking_code(args: Args) -> Response {
    mutate_state(|state| verify_account_linking_code_impl(args, state))
}

// Allows us to verify an existing account linking code, and fetch the user's
// username. The account linking code is verified for the current caller.
// While finalising we won't need the code again, fetching the caller's
// principal will be enough to check the code that was verified.
//
// Username is consumed by the UI while creating the passkey; it's used to label
// the created passkey.
fn verify_account_linking_code_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let caller = state.env.caller();

    // Basically checks if the code provided by the user match any of the codes
    // that are saved.
    let Ok(linking_code) = state.data.account_linking_codes.verify_with_temp_key(args.code, caller, now) else {
        return Response::Error(OCErrorCode::LinkingCodeNotFound.into());
    };

    Response::Success(linking_code.username)
}
