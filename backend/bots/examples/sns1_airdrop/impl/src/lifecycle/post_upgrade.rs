use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use sns1_airdrop::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    // TODO: After release change this to
    // let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();
    canister_logger::init_with_logs(data.test_mode, Vec::new(), logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
