use crate::{Data, RuntimeState, LOG_MESSAGES, RUNTIME_STATE};
use utils::env::Environment;

mod heartbeat;
mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_logger() {
    let log_messages = utils::canister_logger::init_logger(None, ic_cdk::api::time);

    LOG_MESSAGES.with(|c| *c.borrow_mut() = log_messages);
}

fn init_state(env: Box<dyn Environment>, data: Data) {
    let runtime_state = RuntimeState::new(env, data);

    RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
}
