use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{Data, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use proposals_bot_canister::post_upgrade::Args;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (data, log_messages, trace_messages, cycles_dispenser_client_state): (Data, Vec<LogMessage>, Vec<LogMessage>, Vec<u8>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    cycles_dispenser_client::init_from_bytes(&cycles_dispenser_client_state);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages {
        messages_container.logs.push(message);
    }

    for message in trace_messages {
        messages_container.traces.push(message);
    }
}
