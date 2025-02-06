use crate::{check_public_key, mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::prepare_webauthn_delegation::{Response::*, *};

#[update]
#[trace]
fn prepare_webauthn_delegation(args: Args) -> Response {
    mutate_state(|state| prepare_webauthn_delegation_impl(args, state))
}

fn prepare_webauthn_delegation_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(public_key) = state.data.webauthn_keys.get_public_key(args.credential_id.clone().into()) else {
        return CredentialNotFound;
    };

    if let Err(error) = check_public_key(caller, public_key) {
        return PublicKeyInvalid(error);
    }

    let auth_seed = state.data.calculate_webauthn_seed(&args.credential_id);
    let auth_principal = Principal::self_authenticating(state.der_encode_canister_sig_key(auth_seed));
    let Some(user) = state.data.user_principals.get_by_auth_principal(&auth_principal) else {
        return NotFound;
    };

    state.data.webauthn_keys.mark_used(args.credential_id.into(), state.env.now());

    let auth_session = state.prepare_delegation(auth_seed, args.auth_session_key, args.max_time_to_live);

    let seed = state.data.calculate_seed(user.index);
    let user_session = state.prepare_delegation(seed, args.session_key, args.max_time_to_live);

    Success(SuccessResult {
        auth_session,
        user_session,
    })
}
