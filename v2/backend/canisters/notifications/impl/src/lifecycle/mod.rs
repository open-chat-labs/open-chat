use crate::{Data, RuntimeState, LOG_MESSAGES, RUNTIME_STATE, WASM_VERSION};
use types::{Timestamped, Version};
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_logger(enable_trace: bool) {
    let log_messages = canister_logger::init_logger(enable_trace, None, ic_cdk::api::time);

    LOG_MESSAGES.with(|c| *c.borrow_mut() = log_messages);
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: Version) {
    let now = env.now();
    let runtime_state = RuntimeState::new(env, data);

    RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
    WASM_VERSION.with(|v| *v.borrow_mut() = Timestamped::new(wasm_version, now));
}
