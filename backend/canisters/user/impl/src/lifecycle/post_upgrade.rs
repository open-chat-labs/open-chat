use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{Data, LOG_MESSAGES};
use candid::Principal;
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use types::Cryptocurrency;
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    init_logger(data.test_mode);
    LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()));

    // TODO: This code should be removed after it has been deployed
    data.ledger_canister_ids.insert(
        Cryptocurrency::SNS1,
        Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").expect("Invalid principal"),
    );
    data.ledger_canister_ids.insert(
        Cryptocurrency::CKBTC,
        Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").expect("Invalid principal"),
    );

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
