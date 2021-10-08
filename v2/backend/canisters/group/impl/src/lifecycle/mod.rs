use crate::{Data, RuntimeState, LOGGER, LOW_CYCLES_BALANCE_THRESHOLD, RUNTIME_STATE};
use cycles_utils::{check_cycles_balance, init_cycles_balance_checker};
use utils::env::Environment;

mod init;
mod post_upgrade;
mod pre_upgrade;

fn init_logger() {
    let logger = utils::canister_logger::init_logger(None);

    LOGGER.with(|c| *c.borrow_mut() = logger);
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
