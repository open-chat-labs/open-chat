use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk::api::call::call;
use ic_cdk_macros::update;
use types::Salt;
use user_index_canister::create_challenge::*;

#[update]
#[trace]
async fn create_challenge(_args: Args) -> Response {
    let mut seed = None;

    if !read_state(is_rng_initialised) {
        seed = Some(get_random_seed().await);
    }

    mutate_state(|state| create_challenge_impl(seed, state))
}

fn is_rng_initialised(runtime_state: &RuntimeState) -> bool {
    runtime_state.data.challenges.is_initialised()
}

fn create_challenge_impl(seed: Option<Salt>, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    if let Some(seed) = seed {
        runtime_state.data.challenges.initialise(seed);
    }

    match runtime_state.data.challenges.create(now) {
        Some(challenge) => Response::Success(challenge),
        None => Response::Throttled,
    }
}

// Get a random seed based on 'raw_rand'
async fn get_random_seed() -> Salt {
    let raw_rand: Vec<u8> = match call(Principal::management_canister(), "raw_rand", ()).await {
        Ok((res,)) => res,
        Err((_, err)) => ic_cdk::trap(&format!("failed to get seed: {}", err)),
    };

    raw_rand[..].try_into().unwrap_or_else(|_| {
        ic_cdk::trap(&format!(
            "when creating seed from raw_rand output, expected raw randomness to be of length 32, got {}",
            raw_rand.len()
        ));
    })
}
