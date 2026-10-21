use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state};
use crate::{RuntimeState, StorageIndexEvent};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    mutate_state(migrate_accessor_removals);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: the accessors still to be removed by the StorageIndex go via its events queue. Sending
// is deferred while they're pushed, since a call can't be made from within post_upgrade.
// TODO: remove once released
fn migrate_accessor_removals(state: &mut RuntimeState) {
    let now = state.env.now();
    let accessor_ids = state.data.storage_index_accessors_to_remove_queue.take_all();
    let count = accessor_ids.len();
    state
        .data
        .storage_index_event_sync_queue
        .set_state(state.data.storage_index_canister_id);
    state.data.storage_index_event_sync_queue.set_defer_processing(true);
    for accessor_id in accessor_ids {
        state.push_event_to_storage_index(StorageIndexEvent::RemoveAccessor(accessor_id), now);
    }
    state.data.storage_index_event_sync_queue.set_defer_processing(false);
    info!(
        count,
        "Moved the pending accessor removals onto the StorageIndex events queue"
    );
}
