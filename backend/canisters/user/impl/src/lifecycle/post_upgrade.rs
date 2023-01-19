use crate::lifecycle::{init_state, UPGRADE_BUFFER_SIZE};
use crate::Data;
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use types::{Cryptocurrency, LogMessage};
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    let logs = log_messages
        .into_iter()
        .map(|l| canister_logger::LogEntry {
            timestamp: l.timestamp,
            message: l.json,
        })
        .collect();
    let traces = trace_messages
        .into_iter()
        .map(|t| canister_logger::LogEntry {
            timestamp: t.timestamp,
            message: t.json,
        })
        .collect();
    canister_logger::init_with_logs(data.test_mode, logs, traces);

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
