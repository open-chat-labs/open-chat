use crate::{Data, LOG_MESSAGES, RUNTIME_STATE, STATE_VERSION};
use canister_api_macros::trace;
use canister_logger::LogMessagesWrapper;
use ic_cdk_macros::pre_upgrade;
use tracing::info;

#[pre_upgrade]
#[trace]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    RUNTIME_STATE.with(|state| LOG_MESSAGES.with(|l| pre_upgrade_impl(state.take().unwrap().data, l.take())));
}

fn pre_upgrade_impl(data: Data, messages_container: LogMessagesWrapper) {
    let log_messages = messages_container.logs.drain_messages();
    let trace_messages = messages_container.traces.drain_messages();

    let stable_state = (data, log_messages, trace_messages);
    let bytes = serializer::serialize(&stable_state).unwrap();

    ic_cdk::storage::stable_save((STATE_VERSION, &bytes)).unwrap();
}
