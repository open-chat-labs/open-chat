use crate::{Data, RuntimeState, WASM_VERSION, mutate_state};
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, Timestamped};
use utils::canister::get_random_seed;
use utils::env::Environment;
use utils::env::canister::CanisterEnv;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_env(rng_seed: [u8; 32]) -> Box<CanisterEnv> {
    let canister_env = if rng_seed == [0; 32] {
        ic_cdk_timers::set_timer(Duration::ZERO, reseed_rng);
        CanisterEnv::default()
    } else {
        CanisterEnv::new(rng_seed)
    };
    Box::new(canister_env)
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: BuildVersion) {
    if !data.salt.is_initialized() {
        ic_cdk_timers::set_timer(Duration::ZERO, generate_salt);
    }

    let now = env.now();
    let state = RuntimeState::new(env, data);

    crate::jobs::start(&state);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn generate_salt() {
    ic_cdk::futures::spawn(generate_salt_inner());

    async fn generate_salt_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.salt.set(seed);
        });
        trace!("Successfully generated salt");
    }
}

fn reseed_rng() {
    ic_cdk::futures::spawn(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.rng_seed = seed;
            state.env = Box::new(CanisterEnv::new(seed))
        });
        trace!("Successfully reseeded rng");
    }
}
