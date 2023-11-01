use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use cycles_dispenser_canister::post_upgrade::Args;
use ic_cdk::api::stable::StableReader;
use ic_cdk_macros::post_upgrade;
use stable_memory::{deserialize_from_stable_memory, get_reader};
use std::io::Read;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let mut stable_reader = StableReader::default();
    let mut magic = [0u8; 3];
    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) =
        if stable_reader.read_exact(&mut magic).is_ok() && magic == *b"MGR" {
            let memory = get_upgrades_memory();
            let reader = get_reader(&memory);

            serializer::deserialize(reader).unwrap()
        } else {
            deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap()
        };

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
