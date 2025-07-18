use crate::{RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::link_with_account_linking_code::{Args, Response};
use oc_error_codes::OCErrorCode;
use types::OCResult;

// TODO Moved to a shared location, also consider what this means now in
// context of users using passkeys.
const MAX_LINKED_IDENTITIES: usize = 10;

#[update(msgpack = true, candid = true)]
#[trace]
fn link_with_account_linking_code(args: Args) -> Response {
    mutate_state(|state| link_with_account_linking_code_impl(args, state)).into()
}

// Link accounts!
//
// At this point, no user is actually logged in, which means that the `caller`
// value cannot be used to identify any user; but we can figure out principals
// from the user id attached to the linking code.
//
// TODO Consider ways to make this functionality more secure: set limit on the
// number of attempts to link; lock-out after too many failed attempts; log
// and audit failed attempts; consider reducing validity time for linking codes.
fn link_with_account_linking_code_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    // Basically checks if the code provided by the user match any of the codes
    // that are saved.
    let Some(linking_code) = state.data.account_linking_codes.get(&args.code) else {
        return Err(OCErrorCode::LinkingCodeNotFound.into());
    };

    // Check if the linking code is still valid (i.e. not expired).
    if !linking_code.is_valid(state.env.now()) {
        return Err(OCErrorCode::LinkingCodeExpired.into());
    }

    // Verify the new identity using the provided public key and webauthn key.
    // This will also check if the caller is already registered.
    let VerifyNewIdentitySuccess {
        caller: _,
        auth_principal: new_auth_principal,
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
        // return LinkedIdentitiesLimitReached(MAX_LINKED_IDENTITIES as u32);
        return Err(OCErrorCode::UserLimitReached.into());
    }

    // Check if the auth principal is already linked to the target user principal
    if user_principal.auth_principals.contains(&new_auth_principal) {
        return Err(OCErrorCode::PrincipalAlreadyUsed.into());
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
        state.data.account_linking_codes.remove(&args.code);

        // Linking done!
        Ok(())
    } else {
        Err(OCErrorCode::PrincipalAlreadyUsed.into())
    }
}
