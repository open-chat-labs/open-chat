use crate::{init_state as set_state, mutate_state, Data, RuntimeState, WASM_VERSION};
use std::time::Duration;
use tracing::{info, trace};
use types::{BuildVersion, CanisterId, Cycles, Timestamped};
use utils::canister::get_random_seed;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;
use utils::time::MINUTE_IN_MS;

mod heartbeat;
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

    set_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn init_cycles_dispenser_client(cycles_dispenser_canister_id: CanisterId, min_cycles_balance: Cycles) {
    let config = cycles_dispenser_client::Config::new(cycles_dispenser_canister_id)
        .with_interval(5 * MINUTE_IN_MS)
        .with_min_cycles_balance(min_cycles_balance);

    cycles_dispenser_client::start(config);

    info!("Initialized cycles dispenser client");
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
