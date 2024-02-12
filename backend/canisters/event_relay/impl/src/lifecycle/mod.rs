use crate::{mutate_state, Data, RuntimeState, WASM_VERSION};
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, Timestamped};
use utils::canister::get_random_seed;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_env(rng_seed: [u8; 32]) -> Box<CanisterEnv> {
    if rng_seed == [0; 32] {
        ic_cdk_timers::set_timer(Duration::ZERO, reseed_rng);
    }
    Box::new(CanisterEnv::new(rng_seed))
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    let state = RuntimeState::new(env, data);

    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn reseed_rng() {
    ic_cdk::spawn(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.rng_seed = seed;
            state.env = Box::new(CanisterEnv::new(seed));

            // We only want to set the salt once
            if state.data.salt == [0; 32] {
                state.data.salt = seed;
            }
        });
        trace!("Successfully reseeded rng");
    }
}
