use crate::model::user_principals::UserPrincipal;
use crate::{mutate_state, RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::initiate_identity_link::{Response::*, *};

#[update]
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
    }) {
        Ok(ok) => ok,
        Err(error) => {
            return match error {
                VerifyNewIdentityError::AlreadyRegistered => AlreadyRegistered,
                VerifyNewIdentityError::PublicKeyInvalid(e) => PublicKeyInvalid(e),
                VerifyNewIdentityError::OriginatingCanisterInvalid(c) => OriginatingCanisterInvalid(c),
            }
        }
    };

    if get_user_principal_for_oc_user(&args.link_to_principal, state).is_none() {
        return TargetUserNotFound;
    }

    if let Err(response) = check_if_auth_principal_already_exists(&auth_principal, &args.link_to_principal, state) {
        return response;
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

fn check_if_auth_principal_already_exists(
    auth_principal: &Principal,
    link_to_principal: &Principal,
    state: &RuntimeState,
) -> Result<(), Response> {
    let Some(user) = get_user_principal_for_oc_user(auth_principal, state) else {
        return Ok(());
    };

    Err(if user.auth_principals.contains(link_to_principal) {
        AlreadyLinkedToPrincipal
    } else {
        AlreadyRegistered
    })
}

fn get_user_principal_for_oc_user(auth_principal: &Principal, state: &RuntimeState) -> Option<UserPrincipal> {
    state
        .data
        .user_principals
        .get_by_auth_principal(auth_principal)
        .filter(|u| u.user_id.is_some())
}
