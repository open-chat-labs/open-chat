use crate::lifecycle::{init_state, reseed_rng, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use std::time::Duration;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = Box::new(CanisterEnv::default());

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    ic_cdk::timer::set_timer(Duration::default(), reseed_rng);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
