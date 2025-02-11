use crate::model::user_principals::UserPrincipal;
use crate::{check_public_key, extract_originating_canister, mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::initiate_identity_link::{Response::*, *};
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;

#[update]
#[trace]
fn initiate_identity_link(args: Args) -> Response {
    mutate_state(|state| initiate_identity_link_impl(args, state))
}

fn initiate_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Err(response) = check_if_auth_principal_already_exists(&caller, &args.link_to_principal, state) {
        return response;
    }

    if get_user_principal_for_oc_user(&args.link_to_principal, state).is_none() {
        return TargetUserNotFound;
    }

    let (auth_principal, originating_canister) = if args.webauthn_key.is_some() {
        (
            Principal::self_authenticating(&args.public_key),
            WEBAUTHN_ORIGINATING_CANISTER,
        )
    } else {
        if let Err(error) = check_public_key(caller, &args.public_key) {
            return PublicKeyInvalid(error);
        }

        match extract_originating_canister(caller, &args.public_key) {
            Ok(canister_id) => (caller, canister_id),
            Err(error) => return PublicKeyInvalid(error),
        }
    };

    if let Err(response) = check_if_auth_principal_already_exists(&auth_principal, &args.link_to_principal, state) {
        return response;
    }

    state.data.identity_link_requests.push(
        auth_principal,
        args.webauthn_key,
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
