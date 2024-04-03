use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::generate_challenge::{Response::*, *};

#[update]
#[trace]
fn generate_challenge(_args: Args) -> Response {
    mutate_state(generate_challenge_impl)
}

fn generate_challenge_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.user_principals.get_by_auth_principal(&caller).is_some() {
        return AlreadyRegistered;
    }

    match state.data.challenges.create(state.env.now(), state.env.rng()) {
        Some(challenge) => Success(challenge),
        None => Throttled,
    }
}
