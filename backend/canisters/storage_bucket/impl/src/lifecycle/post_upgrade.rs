use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use storage_bucket_canister::post_upgrade::Args;
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

    mutate_state(migrate_index_event_queue);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: moves whatever the queue to `c2c_sync_bucket` still holds onto the queue to
// `c2c_storage_bucket`, ahead of anything queued since the upgrade, wrapping each event in an
// idempotent envelope. A push normally sends at once, which a call made from within post_upgrade
// can't, so sending is deferred while the events are pushed, and the queue's timer sends them next
// round. Removed, with the old queue, once this has run.
fn migrate_index_event_queue(state: &mut RuntimeState) {
    let storage_index_canister_id = state.data.storage_index_canister_id;
    state.data.storage_index_event_sync_queue.set_state(storage_index_canister_id);

    let events: Vec<_> = state
        .data
        .index_event_sync_queue
        .take_all()
        .into_iter()
        .map(|(event, _)| event.into())
        .collect();

    if !events.is_empty() {
        state.data.storage_index_event_sync_queue.set_defer_processing(true);
        state.push_events_to_index(events);
        state.data.storage_index_event_sync_queue.set_defer_processing(false);
    }
}
