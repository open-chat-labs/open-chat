use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::{Data, mutate_state, read_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init_with_small_entries_map(
        get_stable_memory_map_memory(),
        get_stable_memory_map_small_entries_memory(),
    );

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    mutate_state(|state| state.data.drain_legacy_user_event_queue());

    mutate_state(|state| {
        let mut populated = 0;
        for (principal, user_id) in state.data.principal_to_user_id_map.entries() {
            if state.data.chat.members.set_principal(&user_id, principal) {
                populated += 1;
            }
        }
        let members = state.data.chat.members.len();
        info!(populated, members, "Populated member principals");
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
