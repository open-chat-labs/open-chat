use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::approve_identity_link::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true, candid = true)]
#[trace]
fn approve_identity_link(args: Args) -> Response {
    mutate_state(|state| approve_identity_link_impl(args, state)).into()
}

fn approve_identity_link_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();

    let Some(auth_principal) = state.data.user_principals.get_auth_principal(&caller) else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };

    let now = state.env.now();
    state.data.user_principals.bump_last_used(&caller, now);

    state
        .data
        .verify_certificate_time(&auth_principal, &args.delegation.signature, now, 5 * MINUTE_IN_MS)?;

    if let Some(identity_link_request) = state.data.identity_link_requests.take(caller, args.link_initiated_by, now) {
        if state.data.user_principals.link_auth_principal_with_existing_user(
            args.link_initiated_by,
            identity_link_request.originating_canister,
            identity_link_request
                .webauthn_key
                .as_ref()
                .map(|k| k.credential_id.clone().into()),
            identity_link_request.is_ii_principal,
            auth_principal.user_principal_index,
            now,
        ) {
            if let Some(webauthn_key) = identity_link_request.webauthn_key {
                state.data.webauthn_keys.add(webauthn_key, now);
            }
            Ok(())
        } else {
            Err(OCErrorCode::PrincipalAlreadyUsed.into())
        }
    } else {
        Err(OCErrorCode::IdentityLinkRequestNotFound.into())
    }
}
