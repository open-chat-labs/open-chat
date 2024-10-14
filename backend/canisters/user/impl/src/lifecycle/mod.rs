use crate::{mutate_state, regular_jobs, Data, RuntimeState, WASM_VERSION};
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, Timestamped};
use utils::canister::get_random_seed;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

mod init;
mod inspect_message;
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
    let now = env.now();
    let regular_jobs = regular_jobs::build();
    let state = RuntimeState::new(env, data, regular_jobs);

    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn reseed_rng() {
    ic_cdk::spawn(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.rng_seed = seed;
            state.env = Box::new(CanisterEnv::new(seed))
        });
        trace!("Successfully reseeded rng");
    }
}
