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
    let auth_principal = state.caller_auth_principal();

    match state
        .data
        .user_principals
        .remove_auth_principal(auth_principal, args.linked_principal)
    {
        Ok(webauthn_credential_id) => {
            if let Some(credential_id) = webauthn_credential_id {
                state.data.webauthn_keys.remove(credential_id.into_vec());
            }
            Response::Success
        }
        Err(response) => response,
    }
}
