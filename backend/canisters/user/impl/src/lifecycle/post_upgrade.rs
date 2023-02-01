use crate::lifecycle::{init_state, UPGRADE_BUFFER_SIZE};
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = Box::new(CanisterEnv::new());

    let (mut data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    data.direct_chats.fix_icp_transactions();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
