use crate::{RuntimeState, LOG_MESSAGES, RUNTIME_STATE, STATE_VERSION};
use ic_cdk_macros::pre_upgrade;
use tracing::info;
use utils::canister_logger::LogMessagesContainer;

#[pre_upgrade]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    RUNTIME_STATE.with(|state| LOG_MESSAGES.with(|l| pre_upgrade_impl(state.borrow().as_ref().unwrap(), &l.borrow())));
}

fn pre_upgrade_impl(runtime_state: &RuntimeState, messages_container: &LogMessagesContainer) {
    let log_messages = messages_container.drain_messages();

    let data_bytes = candid::encode_one(&runtime_state.data).unwrap();
    let log_messages_bytes = candid::encode_one(log_messages).unwrap();

    let bytes = candid::encode_args((data_bytes, log_messages_bytes)).unwrap();

    ic_cdk::storage::stable_save((STATE_VERSION, bytes)).unwrap();
}
