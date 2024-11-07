use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_chat_events_memory, get_upgrades_memory};
use crate::{read_state, Data};
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
    chat_events::ChatEvents::init_stable_storage(get_chat_events_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // Only proceed with removing events from the heap if the stable memory migration is complete
    assert!(data.stable_memory_event_migration_complete);

    if data.chat.events.thread_messages_to_update_in_stable_memory_len() > 0 {
        data.stable_memory_event_migration_complete = false;
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
