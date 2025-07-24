use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::generate_challenge::{Response::*, *};

#[update(msgpack = true, candid = true)]
#[trace]
fn generate_challenge(_args: Args) -> Response {
    mutate_state(generate_challenge_impl)
}

fn generate_challenge_impl(state: &mut RuntimeState) -> Response {
    let caller = state.caller_auth_principal();

    if state.data.user_principals.auth_principal_exists(&caller) {
        return AlreadyRegistered;
    }

    match state.data.challenges.create(state.env.now(), state.env.rng()) {
        Some(challenge) => Success(challenge),
        None => Throttled,
    }
}
