use crate::lifecycle::{init_state, UPGRADE_BUFFER_SIZE};
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use notifications_index_canister::post_upgrade::Args;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = Box::new(CanisterEnv::new());

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
