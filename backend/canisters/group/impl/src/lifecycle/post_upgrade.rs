use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::{get_upgrades_memory, reset_memory_manager};
use crate::{init_instruction_counts_log, mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use instruction_counts_log::InstructionCountFunctionId;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    reset_memory_manager();
    mutate_state(|state| state.data.instruction_counts_log = init_instruction_counts_log());

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
