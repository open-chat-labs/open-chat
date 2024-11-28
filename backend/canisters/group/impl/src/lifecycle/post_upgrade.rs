use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
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

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        let now = state.env.now();
        let count_removed = state.data.chat.members.prune_member_updates(now);
        info!(count_removed, "Removed old member updates");

        if state.data.chat.subtype.is_some() {
            let count_removed = state.data.chat.members.prune_proposal_votes(now);
            info!(count_removed, "Removed old proposal votes");
        }
    });

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
