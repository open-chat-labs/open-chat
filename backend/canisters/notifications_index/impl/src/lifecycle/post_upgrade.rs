use crate::Data;
use crate::lifecycle::init_state;
use crate::lifecycle::move_subscriptions_of_migrated_users::move_subscriptions_of_migrated_users;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use notifications_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // One-off: the total wasn't reduced when inactive subscriptions were removed
    let previous_total = data.subscriptions.total();
    data.subscriptions.recompute_total();
    info!(
        previous_total,
        total = data.subscriptions.total(),
        "Recomputed the subscriptions total"
    );

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    ic_cdk_timers::set_timer(Duration::ZERO, move_subscriptions_of_migrated_users());

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
