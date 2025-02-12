use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::remove_identity_link::{Args, Response};

#[update]
#[trace]
fn remove_identity_link(args: Args) -> Response {
    mutate_state(|state| remove_identity_link_impl(args, state))
}

fn remove_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key_or(caller);

    state
        .data
        .user_principals
        .remove_auth_principal(auth_principal, args.linked_principal)
}
