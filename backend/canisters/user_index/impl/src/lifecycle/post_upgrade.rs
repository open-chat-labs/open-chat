use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use constants::T;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, Cycles};
use user_index_canister::post_upgrade::Args;
use utils::canister::set_reserved_cycles_limit;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    let local_user_indexes = data.local_index_map.canisters().copied().collect();

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || {
        ic_cdk::futures::spawn(increase_reserved_cycles_limits(local_user_indexes, 20 * T))
    });
}

async fn increase_reserved_cycles_limits(canister_ids: Vec<CanisterId>, cycles: Cycles) {
    let futures: Vec<_> = canister_ids
        .into_iter()
        .map(|canister_id| set_reserved_cycles_limit(canister_id, cycles))
        .collect();

    futures::future::join_all(futures).await;
}
