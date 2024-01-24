use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use identity_canister::check_principal::{Response::*, *};

#[query]
fn check_principal() -> Response {
    read_state(check_principal_impl)
}

fn check_principal_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user) = state.data.user_principals.get(&caller) {
        if user.principal == caller {
            User
        } else {
            Authenticated
        }
    } else if state.data.legacy_principals.contains(&caller) {
        Legacy
    } else {
        NotFound
    }
}
