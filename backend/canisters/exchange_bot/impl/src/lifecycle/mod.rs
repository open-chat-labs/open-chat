use crate::sonic::sonic_canister_id;
use crate::{mutate_state, Data, RuntimeState, WASM_VERSION};
use std::time::Duration;
use tracing::{info, trace};
use types::{BuildVersion, Timestamped};
use utils::canister::get_random_seed;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

mod init;
mod inspect_message;
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

    if state.data.sonic_subaccount.is_none() {
        ic_cdk_timers::set_timer(Duration::default(), retrieve_sonic_subaccount);
    }

    crate::jobs::start(&state);
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

fn retrieve_sonic_subaccount() {
    ic_cdk::spawn(retrieve_sonic_subaccount_inner());

    async fn retrieve_sonic_subaccount_inner() {
        if let Ok(subaccount) = sonic_client::retrieve_subaccount(sonic_canister_id()).await {
            info!("Sonic subaccount set successfully");
            mutate_state(|state| state.data.sonic_subaccount = Some(subaccount));
        } else {
            ic_cdk_timers::set_timer(Duration::from_secs(60), retrieve_sonic_subaccount);
        }
    }
}
