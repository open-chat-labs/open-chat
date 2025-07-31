use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::create_account_linking_code::{Response::*, *};

#[update(msgpack = true, candid = true)]
#[trace]
fn create_account_linking_code(args: Args) -> Response {
    mutate_state(|state| create_account_linking_code_impl(args, state))
}

fn create_account_linking_code_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.caller_auth_principal();

    let Some(auth_principal) = state.data.user_principals.get_auth_principal(&caller) else {
        return UserNotFound;
    };

    let Some(user_id) = state
        .data
        .user_principals
        .user_principal_by_index(auth_principal.user_principal_index)
        .and_then(|p| p.user_id)
    else {
        return UserNotFound;
    };

    let now = state.env.now();
    if state
        .data
        .verify_certificate_time(&auth_principal, &args.delegation.signature, now, 5 * MINUTE_IN_MS)
        .is_err()
    {
        return DelegationTooOld;
    }

    let rng = state.env.rng();

    // Clean up expired codes, keeps the memory footprint smaller in
    // exchange for a bit of extra CPU time.
    state.data.account_linking_codes.prune_expired(now);

    // Does the user have any valid codes?
    let existing_linking_code = state.data.account_linking_codes.get_by_user_id(&user_id);

    if let Some(code) = existing_linking_code {
        if code.is_valid(now + MINUTE_IN_MS) {
            // If the code expires in more than a minute, we return the code
            // back to the user, as we assume this gives them enough time to
            // use it.
            return Success(code);
        } else {
            // Clean up the code if it expires in less than a minute, and
            // generate a new one! Users might have too little time to enter
            // the code, and if we don't do this it may cause weirdness if
            // users have two active codes.
            state.data.account_linking_codes.remove(code.value);
        }
    }

    // Generate new linking code, up to max number of attempts
    Success(state.data.account_linking_codes.get_new_linking_code(user_id, rng, now))
}
