use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use event_relay_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // One-off: stop the test EventRelay pushing events to its EventStore, and drop the events it has
    // pending. Fresh installs (the integration tests and local dev) keep pushing them.
    // TODO remove after the release containing this has been deployed, along with the serde default
    // of `push_to_event_store`
    if data.test_mode {
        data.push_to_event_store = false;
        data.event_store_client.take_events();
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
