use crate::{regular_jobs, Data, RuntimeState, WASM_VERSION};
use types::{Timestamped, Version};
use utils::env::Environment;

mod init;
mod inspect_message;
mod post_upgrade;
mod pre_upgrade;

const UPGRADE_BUFFER_SIZE: usize = 1024 * 1024; // 1MB

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: Version) {
    let now = env.now();
    let regular_jobs = regular_jobs::build();
    let runtime_state = RuntimeState::new(env, data, regular_jobs);

    crate::init_state(runtime_state);
    WASM_VERSION.with(|v| *v.borrow_mut() = Timestamped::new(wasm_version, now));
}
