use crate::{Data, RuntimeState, WASM_VERSION};
use types::{BuildVersion, Timestamped};
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    let state = RuntimeState::new(env, data);

    crate::jobs::start(&state);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}
