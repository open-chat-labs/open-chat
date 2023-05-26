use crate::{init_state as set_state, mutate_state, Data, RuntimeState, WASM_VERSION};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, Cycles, Timestamped, Version};
use utils::env::canister::CanisterEnv;
use utils::env::Environment;
use utils::time::MINUTE_IN_MS;

mod heartbeat;
mod init;
mod post_upgrade;
mod pre_upgrade;

const BUFFER_SIZE: usize = 4 * 1024 * 1024; // 4MB

fn init_env() -> Box<CanisterEnv> {
    ic_cdk_timers::set_timer(Duration::ZERO, reseed_rng);
    Box::default()
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: Version) {
    let now = env.now();
    let state = RuntimeState::new(env, data);

    set_state(state);
    WASM_VERSION.with(|v| *v.borrow_mut() = Timestamped::new(wasm_version, now));
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
        match ic_cdk::api::management_canister::main::raw_rand().await {
            Ok((bytes,)) => {
                let seed: [u8; 32] = bytes.try_into().unwrap();
                mutate_state(|state| state.env = Box::new(CanisterEnv::new(seed)));
                trace!("Successfully reseeded rng");
            }
            Err(error) => error!(?error, "Failed to call 'raw_rand'"),
        }
    }
}
