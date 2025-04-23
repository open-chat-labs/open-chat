use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::remove_identity_link::{Args, Response};

#[update(msgpack = true, candid = true)]
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
