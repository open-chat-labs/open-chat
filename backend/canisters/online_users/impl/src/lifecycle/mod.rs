use crate::{init_state as set_state, Data, RuntimeState, LOG_MESSAGES, WASM_VERSION};
use types::{CanisterId, Timestamped, Version};
use utils::consts::MIN_CYCLES_BALANCE;
use utils::env::Environment;
use utils::time::MINUTE_IN_MS;

mod heartbeat;
mod init;
mod post_upgrade;
mod pre_upgrade;

const UPGRADE_BUFFER_SIZE: usize = 1024 * 1024; // 1MB

fn init_logger(enable_trace: bool) {
    let log_messages = canister_logger::init_logger(enable_trace, None, ic_cdk::api::time);

    LOG_MESSAGES.with(|c| *c.borrow_mut() = log_messages);
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: Version) {
    let now = env.now();
    let runtime_state = RuntimeState::new(env, data);

    set_state(runtime_state);
    WASM_VERSION.with(|v| *v.borrow_mut() = Timestamped::new(wasm_version, now));
}

fn init_cycles_dispenser_client(cycles_dispenser_canister_id: CanisterId) {
    let config = cycles_dispenser_client::Config::new(cycles_dispenser_canister_id)
        .with_interval(5 * MINUTE_IN_MS)
        .with_min_cycles_balance(3 * MIN_CYCLES_BALANCE / 2);

    cycles_dispenser_client::start(config);
}
