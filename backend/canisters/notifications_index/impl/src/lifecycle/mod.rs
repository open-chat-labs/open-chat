use crate::{init_state as set_state, Data, RuntimeState, LOG_MESSAGES, WASM_VERSION};
use types::{Timestamped, Version};
use utils::env::Environment;

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

    crate::jobs::start(&runtime_state);

    set_state(runtime_state);
    WASM_VERSION.with(|v| *v.borrow_mut() = Timestamped::new(wasm_version, now));
}
