use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::get_webauthn_delegation::*;

#[query]
fn get_webauthn_delegation(args: Args) -> Response {
    read_state(|state| get_webauthn_delegation_impl(args, state))
}

fn get_webauthn_delegation_impl(args: Args, state: &RuntimeState) -> Response {
    let seed = state.data.calculate_webauthn_seed(&args.credential_id);

    if let Some(delegation) = state.data.get_delegation(args.session_key, args.expiration, seed) {
        Response::Success(delegation)
    } else {
        Response::NotFound
    }
}
