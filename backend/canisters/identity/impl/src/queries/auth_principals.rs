use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::auth_principals::{Response::*, *};

#[query]
fn auth_principals() -> Response {
    read_state(auth_principals_impl)
}

fn auth_principals_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_principal) = state.data.user_principals.get_by_auth_principal(&caller) {
        Success(
            user_principal
                .auth_principals
                .into_iter()
                .flat_map(|p| {
                    state.data.user_principals.get_auth_principal(&p).map(|a| UserPrincipal {
                        principal: p,
                        originating_canister: a.originating_canister,
                        is_ii_principal: a.is_ii_principal,
                        last_used: a.last_used,
                    })
                })
                .collect(),
        )
    } else {
        NotFound
    }
}
