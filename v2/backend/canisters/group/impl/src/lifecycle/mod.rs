use crate::{regular_jobs, Data, RuntimeState, LOG_MESSAGES, RUNTIME_STATE};
use utils::env::Environment;

mod init;
mod inspect_message;
mod post_upgrade;
mod pre_upgrade;

fn init_logger(enable_trace: bool) {
    let log_messages = canister_logger::init_logger(enable_trace, None, ic_cdk::api::time);

    LOG_MESSAGES.with(|c| *c.borrow_mut() = log_messages);
}

fn init_state(env: Box<dyn Environment>, data: Data) {
    let regular_jobs = regular_jobs::build();
    let runtime_state = RuntimeState::new(env, data, regular_jobs);

    RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
}
