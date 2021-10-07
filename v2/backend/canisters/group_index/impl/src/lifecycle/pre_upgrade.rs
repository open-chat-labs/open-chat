use crate::{RuntimeState, LOGGER, RUNTIME_STATE, STATE_VERSION};
use ic_cdk_macros::pre_upgrade;
use slog::info;
use slog_scope::with_logger;
use utils::canister_logger::LogMessagesContainer;

#[pre_upgrade]
fn pre_upgrade() {
    with_logger(|l| info!(l, "Pre-upgrade starting"));

    RUNTIME_STATE
        .with(|state| LOGGER.with(|c| pre_upgrade_impl(state.borrow().as_ref().unwrap(), c.borrow().messages_container())));
}

fn pre_upgrade_impl(runtime_state: &RuntimeState, messages_container: &LogMessagesContainer) {
    let log_messages = messages_container.drain_messages();

    let data_bytes = candid::encode_one(&runtime_state.data).unwrap();
    let log_messages_bytes = candid::encode_one(log_messages).unwrap();

    let bytes = candid::encode_args((data_bytes, log_messages_bytes)).unwrap();

    ic_cdk::storage::stable_save((STATE_VERSION, bytes)).unwrap();
}
