use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::check_auth_principal::{Response::*, *};

#[query]
fn check_auth_principal() -> Response {
    read_state(check_auth_principal_impl)
}

fn check_auth_principal_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let auth_principal = state.data.user_principals.unwrap_temp_key(caller);

    if state.data.user_principals.get_by_auth_principal(&auth_principal).is_some() {
        Success
    } else {
        NotFound
    }
}
