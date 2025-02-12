use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use ic_cdk::update;
use ic_certificate_verification::VerifyCertificate;
use identity_canister::approve_identity_link::{Response::*, *};
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;
use identity_utils::extract_certificate;

#[update]
#[trace]
fn approve_identity_link(args: Args) -> Response {
    mutate_state(|state| approve_identity_link_impl(args, state))
}

fn approve_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(auth_principal) = state.data.user_principals.get_auth_principal(&caller) else {
        return CallerNotRecognised;
    };

    let now = state.env.now();
    state.data.user_principals.bump_last_used(&caller, now);

    if auth_principal.originating_canister != WEBAUTHN_ORIGINATING_CANISTER {
        let certificate = match extract_certificate(&args.delegation.signature) {
            Ok(c) => c,
            Err(e) => return MalformedSignature(e),
        };
        if certificate
            .verify(
                auth_principal.originating_canister.as_slice(),
                state.data.ic_root_key.as_slice(),
            )
            .is_err()
        {
            return InvalidSignature;
        }

        let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
        let five_minutes = (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND) as u128;

        if ic_certificate_verification::validate_certificate_time(&certificate, &now_nanos, &five_minutes).is_err() {
            return DelegationTooOld;
        }
    }

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
            Success
        } else {
            PrincipalAlreadyLinkedToAnotherOcUser
        }
    } else {
        LinkRequestNotFound
    }
}
