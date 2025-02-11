use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::check_auth_principal_v2::{Response::*, *};

#[query]
fn check_auth_principal_v2() -> Response {
    read_state(check_auth_principal_impl)
}

fn check_auth_principal_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key(caller);

    if let Some(user_principal) = state.data.user_principals.get_by_auth_principal(&auth_principal) {
        Success(SuccessResult {
            user_id: user_principal.user_id,
            webauthn_key: state
                .data
                .user_principals
                .get_auth_principal(&auth_principal)
                .and_then(|p| p.webauthn_credential_id)
                .and_then(|id| state.data.webauthn_keys.get(id.clone()).map(|k| k.hydrate(id))),
        })
    } else {
        NotFound
    }
}
