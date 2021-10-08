use crate::{Data, RuntimeState, LOGGER, RUNTIME_STATE};
use utils::env::Environment;

mod heartbeat;
mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_logger() {
    let logger = utils::canister_logger::init_logger(None);

    LOGGER.with(|c| *c.borrow_mut() = logger);
}

fn init_state(env: Box<dyn Environment>, data: Data) {
    let runtime_state = RuntimeState::new(env, data);

    RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
}
