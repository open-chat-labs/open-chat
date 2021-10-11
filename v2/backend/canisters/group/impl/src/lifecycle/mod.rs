use crate::{Data, RuntimeState, LOG_MESSAGES, LOW_CYCLES_BALANCE_THRESHOLD, RUNTIME_STATE};
use cycles_utils::{check_cycles_balance, init_cycles_balance_checker};
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_logger() {
    let log_messages = utils::canister_logger::init_logger(None, ic_cdk::api::time);

    LOG_MESSAGES.with(|c| *c.borrow_mut() = log_messages);
}

fn init_state(env: Box<dyn Environment>, data: Data) {
    let group_index_canister_id = data.group_index_canister_id;
    let runtime_state = RuntimeState::new(env, data);

    RUNTIME_STATE.with(|state| {
        *state.borrow_mut() = Some(runtime_state);

        init_cycles_balance_checker(LOW_CYCLES_BALANCE_THRESHOLD, group_index_canister_id);
    });

    check_cycles_balance();
}
