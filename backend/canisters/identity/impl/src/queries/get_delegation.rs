use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::get_delegation::{Response::*, *};

#[query]
fn get_delegation(args: Args) -> Response {
    read_state(|state| get_delegation_impl(args, state))
}

fn get_delegation_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) else {
        panic!("Caller not recognised");
    };

    let seed = state.data.calculate_seed(user.index);

    if let Some(delegation) = state.data.get_delegation(args.session_key, args.expiration, seed) {
        Success(delegation)
    } else {
        NotFound
    }
}
