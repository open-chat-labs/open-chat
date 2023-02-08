use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::create_challenge::*;
use utils::canister;

#[update]
#[trace]
async fn create_challenge(_args: Args) -> Response {
    let mut seed = None;

    if !read_state(is_rng_initialised) {
        seed = Some(canister::get_random_seed().await);
    }

    mutate_state(|state| create_challenge_impl(seed, state))
}

fn is_rng_initialised(runtime_state: &RuntimeState) -> bool {
    runtime_state.data.challenges.is_initialised()
}

fn create_challenge_impl(seed: Option<[u8; 32]>, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    if let Some(seed) = seed {
        runtime_state.data.challenges.initialise(seed);
    }

    match runtime_state.data.challenges.create(now) {
        Some(challenge) => Response::Success(challenge),
        None => Response::Throttled,
    }
}
