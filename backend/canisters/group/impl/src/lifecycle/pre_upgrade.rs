use crate::{take_state, LOG_MESSAGES, STATE_VERSION};
use canister_api_macros::trace;
use ic_cdk_macros::pre_upgrade;
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
    let bytes = serializer::serialize(&stable_state).unwrap();

    ic_cdk::storage::stable_save((STATE_VERSION, &bytes)).unwrap();
}
