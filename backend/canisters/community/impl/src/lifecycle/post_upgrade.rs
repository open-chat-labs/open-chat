use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    data.events.fix_role_changed_events();

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
