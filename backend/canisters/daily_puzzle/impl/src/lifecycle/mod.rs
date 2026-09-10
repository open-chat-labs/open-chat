use crate::jobs::{generate_candidates, push_puzzle};
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
        ic_cdk_timers::set_timer(Duration::ZERO, async { reseed_rng() });
        CanisterEnv::default()
    } else {
        CanisterEnv::new(rng_seed)
    };
    Box::new(canister_env)
}

fn init_state(env: Box<dyn Environment>, mut data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    data.ensure_puzzles(now);
    let state = RuntimeState::new(env, data);

    crate::jobs::start(&state);
    push_puzzle::schedule(true, Duration::ZERO);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn reseed_rng() {
    ic_cdk::futures::spawn_migratory(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.rng_seed = seed;
            if state.data.master_seed == 0 {
                state.data.master_seed = u64::from_le_bytes(seed[..8].try_into().unwrap());
            }
            state.env = Box::new(CanisterEnv::new(seed));
            generate_candidates::start_job_if_required(state);
        });
        trace!("Successfully reseeded rng");
    }
}
