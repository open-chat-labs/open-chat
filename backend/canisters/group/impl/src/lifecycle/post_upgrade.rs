use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{Data, NewJoinerRewards, LOG_MESSAGES};
use candid::Principal;
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use types::ICP;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

const E8S_PER_TOKEN: u64 = 100_000_000;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    let icp_party_private_group = Principal::from_text("5akog-wqaaa-aaaaf-avpjq-cai").unwrap();
    if env.canister_id() == icp_party_private_group && data.new_joiner_rewards.is_none() {
        let start = 1668018600000; // 9th November at 16:30 GMT
        data.new_joiner_rewards = Some(NewJoinerRewards::new(
            100,
            ICP::from_e8s(5 * E8S_PER_TOKEN),
            Some(start),
            None,
        ));
    }

    data.events.end_overdue_polls(env.now());

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

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
