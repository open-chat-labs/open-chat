use crate::{RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::link_with_account_linking_code::{Response::*, *};

// TODO Moved to a shared location, also consider what this means now in
// context of users using passkeys.
const MAX_LINKED_IDENTITIES: usize = 10;

#[update(msgpack = true, candid = true)]
#[trace]
fn link_with_account_linking_code(args: Args) -> Response {
    mutate_state(|state| link_with_account_linking_code_impl(args, state))
}

// TODO making this more secure:
// - rate limit the number of attempts to link,
// - lockout after too many attempts
// - log and audit failed attempts (?)
// - consider reducing the time window for the linking code to be valid
fn link_with_account_linking_code_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Get user ID and account linking code from the state. `args.code` is the
    // linking code provided by the user.
    let Some((user_id, linking_code)) = state.data.account_linking_codes.get(&args.code) else {
        return LinkingCodeNotFound;
    };

    // Returns user principal, and the list of auth principals linked to that user principal.
    if let Some((link_to_principal, auth_principals)) = state.data.user_principals.find_user_principal_by_user_id(*user_id) {
        // Verify the new identity using the provided public key and webauthn key.
        // This will also check if the caller is already registered.
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
                return match error {
                    VerifyNewIdentityError::AlreadyRegistered => AlreadyRegistered,
                    VerifyNewIdentityError::PublicKeyInvalid(e) => PublicKeyInvalid(e),
                    VerifyNewIdentityError::OriginatingCanisterInvalid(c) => OriginatingCanisterInvalid(c),
                };
            }
        };

        // Check if the linking code is expired.
        if !linking_code.is_valid(state.env.now()) {
            return LinkingCodeExpired;
        }

        // Check if the linking code is valid.
        if linking_code.value != args.code {
            return LinkingCodeInvalid;
        }

        // Check that the target user principal has not reached the maximum number of linked identities
        if auth_principals.len() >= MAX_LINKED_IDENTITIES {
            return LinkedIdentitiesLimitReached(MAX_LINKED_IDENTITIES as u32);
        }

        // Check if the auth principal is already linked to the target user principal
        if auth_principals.contains(&auth_principal) {
            return AlreadyLinkedToPrincipal;
        }

        state.data.identity_link_requests.push(
            auth_principal,
            webauthn_key,
            originating_canister,
            false,
            link_to_principal,
            state.env.now(),
        );

        // Remove the linking code from the state, as it has been used.
        state.data.account_linking_codes.remove(&args.code);

        Success
    } else {
        TargetUserNotFound
    }
}
