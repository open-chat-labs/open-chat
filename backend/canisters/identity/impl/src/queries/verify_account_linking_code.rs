use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use identity_canister::verify_account_linking_code::{Args, Response};

#[query(msgpack = true, candid = true)]
fn verify_account_linking_code(args: Args) -> Response {
    read_state(|state| verify_account_linking_code_impl(args, state))
}

// Verify that the account linking code is correct & valid for the caller's user ID.
fn verify_account_linking_code_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    if let Some(user_id) = state.get_user_id_by_caller() {
        if let Some((alc_user_id, alc)) = state.data.account_linking_codes.get(&args.code) {
            // Check if the account linking code is valid and matches the user ID.
            Response(alc.is_valid(now) && alc.value == args.code && user_id == *alc_user_id)
        } else {
            Response(false)
        }
    } else {
        Response(false)
    }
}
