use crate::{Data, RuntimeState, WASM_VERSION, regular_jobs};
use types::{BuildVersion, Timestamped};
use utils::env::Environment;

mod init;
mod inspect_message;
mod post_upgrade;
mod pre_upgrade;

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    let regular_jobs = regular_jobs::build();
    let state = RuntimeState::new(env, data, regular_jobs);

    crate::jobs::start(&state);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}
