use crate::{RuntimeState, LOG_MESSAGES, RUNTIME_STATE, STATE_VERSION};
use canister_logger::LogMessagesWrapper;
use ic_cdk_macros::pre_upgrade;
use tracing::{info, instrument};

#[pre_upgrade]
#[instrument(level = "trace")]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    RUNTIME_STATE.with(|state| LOG_MESSAGES.with(|l| pre_upgrade_impl(state.borrow().as_ref().unwrap(), &l.borrow())));
}

fn pre_upgrade_impl(runtime_state: &RuntimeState, messages_container: &LogMessagesWrapper) {
    let log_messages = messages_container.logs.drain_messages();
    let trace_messages = messages_container.traces.drain_messages();

    let data_bytes = candid::encode_one(&runtime_state.data).unwrap();
    let log_messages_bytes = candid::encode_args((log_messages, trace_messages)).unwrap();

    let bytes = candid::encode_args((data_bytes, log_messages_bytes)).unwrap();

    ic_cdk::storage::stable_save((STATE_VERSION, bytes)).unwrap();
}
