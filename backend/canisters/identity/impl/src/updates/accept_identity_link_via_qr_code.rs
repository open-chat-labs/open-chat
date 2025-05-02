use crate::{RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::accept_identity_link_via_qr_code::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn accept_identity_link_via_qr_code(args: Args) -> Response {
    mutate_state(|state| accept_identity_link_via_qr_code_impl(args, state)).into()
}

fn accept_identity_link_via_qr_code_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let VerifyNewIdentitySuccess {
        caller: _,
        auth_principal,
        originating_canister,
        webauthn_key,
    } = match state.verify_new_identity(VerifyNewIdentityArgs {
        public_key: args.public_key,
        webauthn_key: args.webauthn_key,
        allow_existing_provided_not_linked_to_oc_account: true,
    }) {
        Ok(ok) => ok,
        Err(error) => {
            return Err(match error {
                VerifyNewIdentityError::AlreadyRegistered => OCErrorCode::AlreadyRegistered.into(),
                VerifyNewIdentityError::PublicKeyInvalid(e) => OCErrorCode::InvalidPublicKey.with_message(e),
                VerifyNewIdentityError::OriginatingCanisterInvalid(c) => {
                    OCErrorCode::InvalidOriginatingCanister.with_message(c)
                }
            });
        }
    };

    let now = state.env.now();
    if let Some(identity_link_request) = state.data.identity_link_via_qr_code_requests.take(args.link_code, now) {
        if state.data.user_principals.link_auth_principal_with_existing_user(
            auth_principal,
            originating_canister,
            webauthn_key.as_ref().map(|k| k.credential_id.clone().into()),
            args.is_ii_principal,
            identity_link_request.user_principal_index,
            now,
        ) {
            if let Some(webauthn_key) = webauthn_key {
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
