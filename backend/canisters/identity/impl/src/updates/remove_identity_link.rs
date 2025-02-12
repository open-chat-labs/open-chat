use crate::model::user_principals::RemoveAuthPrincipalResult;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::remove_identity_link::{Response::*, *};

#[update]
#[trace]
fn remove_identity_link(args: Args) -> Response {
    mutate_state(|state| remove_identity_link_impl(args, state))
}

fn remove_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key(caller);

    match state
        .data
        .user_principals
        .remove_auth_principal(auth_principal, args.linked_principal)
    {
        RemoveAuthPrincipalResult::Success(webauthn_credential_id) => {
            if let Some(credential_id) = webauthn_credential_id {
                state.data.webauthn_keys.remove(credential_id);
            }
            Success
        }
        RemoveAuthPrincipalResult::CannotUnlinkActivePrincipal => CannotUnlinkActivePrincipal,
        RemoveAuthPrincipalResult::IdentityLinkNotFound => IdentityLinkNotFound,
        RemoveAuthPrincipalResult::UserNotFound => UserNotFound,
    }
}
