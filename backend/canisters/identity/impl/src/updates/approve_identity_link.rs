use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cbor::{parse_cbor, CborValue, CertificateToCbor};
use ic_cdk::update;
use ic_certificate_verification::VerifyCertificate;
use ic_certification::Certificate;
use identity_canister::approve_identity_link::{Response::*, *};
use utils::time::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};

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
    let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
    let five_minutes = (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND) as u128;

    let Ok(cbor) = parse_cbor(&args.delegation.signature) else {
        return MalformedSignature("Unable to parse signature as CBOR".to_string());
    };
    let CborValue::Map(map) = cbor else {
        return MalformedSignature("Expected CBOR map".to_string());
    };
    let Some(CborValue::ByteString(certificate_bytes)) = map.get("certificate") else {
        return MalformedSignature("Couldn't find certificate".to_string());
    };
    let Ok(certificate) = Certificate::from_cbor(certificate_bytes) else {
        return MalformedSignature("Unable to parse certificate".to_string());
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
    if ic_certificate_verification::validate_certificate_time(&certificate, &now_nanos, &five_minutes).is_err() {
        return DelegationTooOld;
    }

    if let Some((originating_canister, is_ii_principal)) =
        state.data.identity_link_requests.take(caller, args.link_initiated_by, now)
    {
        if state.data.user_principals.link_auth_principal_with_existing_user(
            args.link_initiated_by,
            originating_canister,
            is_ii_principal,
            auth_principal.user_principal_index,
        ) {
            Success
        } else {
            PrincipalAlreadyLinkedToAnotherOcUser
        }
    } else {
        LinkRequestNotFound
    }
}
