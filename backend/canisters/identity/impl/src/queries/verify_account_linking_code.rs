use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use identity_canister::verify_account_linking_code::{Args, Response};

#[query(msgpack = true, candid = true)]
fn verify_account_linking_code(args: Args) -> Response {
    read_state(|state| verify_account_linking_code_impl(args, state))
}

// Verify that the account linking code exists and is valid & correct.
//
// We're assuming this will be called by the user on a new device, trying to
// link to their existing account.
// TODO Make this a bit more secure: rate limit number of request.
fn verify_account_linking_code_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    if let Some(linking_code) = state.data.account_linking_codes.get(&args.code) {
        // Check if the account linking code is valid!
        Response(linking_code.is_valid(now) && linking_code.value == args.code)
    } else {
        Response(false)
    }
}
