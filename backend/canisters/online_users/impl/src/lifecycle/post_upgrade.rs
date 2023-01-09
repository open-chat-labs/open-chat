use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{Data, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use online_users_canister::post_upgrade::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        serializer::deserialize(reader).unwrap();

    init_logger(data.test_mode);
    LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()));

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

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
