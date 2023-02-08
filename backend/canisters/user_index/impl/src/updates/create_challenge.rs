use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::create_challenge::*;

#[update]
#[trace]
async fn create_challenge(_args: Args) -> Response {
    mutate_state(create_challenge_impl)
}

fn create_challenge_impl(runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.challenges.create(now, &mut runtime_state.env.rng()) {
        Some(challenge) => Response::Success(challenge),
        None => Response::Throttled,
    }
}
