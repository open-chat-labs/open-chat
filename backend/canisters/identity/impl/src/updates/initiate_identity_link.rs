use crate::{RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::initiate_identity_link::{Response::*, *};

const MAX_LINKED_IDENTITIES: usize = 10;

#[update(msgpack = true, candid = true)]
#[trace]
fn initiate_identity_link(args: Args) -> Response {
    mutate_state(|state| initiate_identity_link_impl(args, state))
}

fn initiate_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let VerifyNewIdentitySuccess {
        caller: _,
        auth_principal,
        originating_canister,
        webauthn_key,
    } = match state.verify_new_identity(VerifyNewIdentityArgs {
        public_key: args.public_key,
        webauthn_key: args.webauthn_key,
        override_principal: None,
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

    if let Some(existing_user_principal) = state.data.user_principals.get_by_auth_principal(&args.link_to_principal) {
        if existing_user_principal.auth_principals.len() >= MAX_LINKED_IDENTITIES {
            return LinkedIdentitiesLimitReached(MAX_LINKED_IDENTITIES as u32);
        } else if existing_user_principal.auth_principals.contains(&auth_principal) {
            return AlreadyLinkedToPrincipal;
        }
    } else {
        return TargetUserNotFound;
    }

    state.data.identity_link_requests.push(
        auth_principal,
        webauthn_key,
        originating_canister,
        args.is_ii_principal.unwrap_or_default(),
        args.link_to_principal,
        state.env.now(),
    );

    Success
}
