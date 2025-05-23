use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use identity_canister::auth_principals::{Response::*, *};

#[query(msgpack = true, candid = true)]
fn auth_principals(_args: Args) -> Response {
    read_state(auth_principals_impl)
}

fn auth_principals_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key_or(caller);

    if let Some(user_principal) = state.data.user_principals.get_by_auth_principal(&auth_principal) {
        Success(
            user_principal
                .auth_principals
                .into_iter()
                .flat_map(|p| {
                    state.data.user_principals.get_auth_principal(&p).map(|a| UserPrincipal {
                        principal: p,
                        originating_canister: a.originating_canister,
                        is_ii_principal: a.is_ii_principal,
                        is_current_identity: p == auth_principal,
                        webauthn_key: a
                            .webauthn_credential_id
                            .and_then(|id| state.data.webauthn_keys.get(id.clone()).map(|k| k.hydrate(id))),
                        last_used: a.last_used,
                    })
                })
                .collect(),
        )
    } else {
        NotFound
    }
}
