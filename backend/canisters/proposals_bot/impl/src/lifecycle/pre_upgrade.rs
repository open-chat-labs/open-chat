use crate::lifecycle::UPGRADE_BUFFER_SIZE;
use crate::{take_state, LOG_MESSAGES};
use canister_tracing_macros::trace;
use ic_cdk_macros::pre_upgrade;
use stable_memory::serialize_to_stable_memory;
use tracing::info;

#[pre_upgrade]
#[trace]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    let state = take_state();

    let messages_container = LOG_MESSAGES.with(|l| l.take());
    let log_messages = messages_container.logs.drain_messages();
    let trace_messages = messages_container.traces.drain_messages();

    let stable_state = (state.data, log_messages, trace_messages);

    serialize_to_stable_memory(stable_state, UPGRADE_BUFFER_SIZE).unwrap();
}
