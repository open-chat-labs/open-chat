use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::finalise_account_linking_with_code::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

// TODO Moved to a shared location, also consider what this means now in
// context of users using passkeys.
const MAX_LINKED_IDENTITIES: usize = 10;

#[update(msgpack = true, candid = true)]
#[trace]
fn finalise_account_linking_with_code(args: Args) -> Response {
    mutate_state(|state| match finalise_account_linking_with_code_impl(args, state) {
        Ok(res) => Response::Success(res),
        Err(oc_error) => Response::Error(oc_error),
    })
}

// Finalise account linking with code!
//
// At this point, we use the caller principal as a temp_key to get the linking
// code that was already verified, then verify the new identity, and finally link
// the new principal with an existing user.
fn finalise_account_linking_with_code_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    let now = state.env.now();

    let Some(linking_code) = state.data.account_linking_codes.get_verified_by_temp_key(&caller) else {
        return Err(OCErrorCode::LinkingCodeNotFound.into());
    };

    // At this point, we've verified the account linking code, and verify identity
    // will not allow us to link with any already existing principal.
    let VerifyNewIdentitySuccess {
        caller: _,
        auth_principal: new_auth_principal,
        originating_canister,
        webauthn_key,
    } = match state.verify_new_identity(VerifyNewIdentityArgs {
        public_key: args.public_key,
        webauthn_key: args.webauthn_key,
        override_principal: Some(args.principal),
        allow_existing_provided_not_linked_to_oc_account: true,
    }) {
        Ok(ok) => ok,
        Err(error) => {
            return Err(match error {
                VerifyNewIdentityError::AlreadyRegistered => OCErrorCode::AlreadyRegistered.into(),
                VerifyNewIdentityError::PublicKeyInvalid(_) => OCErrorCode::InvalidPublicKey.into(),
                VerifyNewIdentityError::OriginatingCanisterInvalid(_) => OCErrorCode::InvalidOriginatingCanister.into(),
            });
        }
    };

    // Returns the list of auth principals for a given user id.
    let Some(user_principal) = state
        .data
        .user_principals
        .find_user_principal_by_user_id(linking_code.user_id)
    else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };

    // Check that the target user principal has not reached the maximum number of linked identities
    if user_principal.auth_principals.len() >= MAX_LINKED_IDENTITIES {
        return Err(OCErrorCode::MaxLinkedIdentitiesLimitReached.into());
    }

    // Link the user with the new auth principal!
    if state.data.user_principals.link_auth_principal_with_existing_user(
        new_auth_principal,
        originating_canister,
        webauthn_key.as_ref().map(|k| k.credential_id.clone().into()),
        false,
        user_principal.index,
        now,
    ) {
        if let Some(webauthn_key) = webauthn_key {
            state.data.webauthn_keys.add(webauthn_key, now);
        }

        // Remove the linking code from the state, as it has been used.
        state.data.account_linking_codes.remove_verified(&caller);

        state
            .data
            .user_principals
            .add_temp_key(caller, new_auth_principal, now, now + 5 * MINUTE_IN_MS);

        let seed = state.data.calculate_seed(user_principal.index);

        Ok(prepare_delegation_inner(seed, args.session_key, args.max_time_to_live, state))
    } else {
        Err(OCErrorCode::PrincipalAlreadyUsed.into())
    }
}
