use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use multi_user_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init_multi_user(get_stable_memory_map_memory(), get_stable_memory_map_small_entries_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // One-off: moves every user's direct chats, groups and communities into stable memory
    let mut moved = 0;
    data.users.for_each_mut(|_, user| moved += user.migrate_to_stable_memory());
    info!(moved, "Moved the direct chats, groups and communities into stable memory");

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
