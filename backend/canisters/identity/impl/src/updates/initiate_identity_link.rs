use crate::{extract_originating_canister, mutate_state, RuntimeState};
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
    // this is the initiator
    let caller = state.env.caller();

    if let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) {
        return if user.auth_principals.contains(&args.link_to_principal) {
            AlreadyLinkedToPrincipal
        } else {
            AlreadyRegistered
        };
    }
    if !is_registered_as_user(&args.link_to_principal, state) {
        return TargetUserNotFound;
    }

    let originating_canister = match extract_originating_canister(caller, &args.public_key) {
        Ok(c) => c,
        Err(error) => return PublicKeyInvalid(error),
    };

    state
        .data
        .identity_link_requests
        .push(caller, originating_canister, args.link_to_principal, state.env.now());

    Success
}

fn is_registered_as_user(auth_principal: &Principal, state: &RuntimeState) -> bool {
    state
        .data
        .user_principals
        .get_by_auth_principal(auth_principal)
        .is_some_and(|u| u.user_id.is_some())
}
