use crate::Data;
use crate::lifecycle::{CANISTER_POOL_TARGET_SIZE, init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // One-off: stop refilling the pool, and refund the cycles held by the canisters already in it,
    // since a canister taken from the pool is now given its cycles when it is used.
    // TODO remove in the release after this one
    data.canister_pool.set_target_size(CANISTER_POOL_TARGET_SIZE);
    let pool_canisters_queued = data.refund_pool_canisters();
    info!(
        pool_canisters_queued,
        "Queued the pool canisters to have their cycles refunded"
    );

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
