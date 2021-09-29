use crate::{Data, RuntimeState, RUNTIME_STATE};
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_state(env: Box<dyn Environment>, data: Data) {
    let runtime_state = RuntimeState::new(env, data);

    RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
}
