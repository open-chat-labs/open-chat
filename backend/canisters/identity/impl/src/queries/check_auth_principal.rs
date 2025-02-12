use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::check_auth_principal::{Response::*, *};

#[query]
fn check_auth_principal() -> Response {
    read_state(check_auth_principal_impl)
}

fn check_auth_principal_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key_or(caller);

    if state.data.user_principals.auth_principal_exists(&auth_principal) {
        Success
    } else {
        NotFound
    }
}
