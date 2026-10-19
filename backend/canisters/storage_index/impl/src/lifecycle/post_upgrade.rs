use crate::Data;
use crate::lifecycle::{init_cycles_dispenser_client, init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::bucket_event_batch::EventToSync;
use crate::{RuntimeState, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::collections::BTreeMap;
use storage_bucket_canister::StorageIndexEvent;
use storage_index_canister::post_upgrade::Args;
use tracing::info;
use types::CanisterId;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(
        data.cycles_dispenser_config.canister_id,
        data.cycles_dispenser_config.min_cycles_balance,
    );

    init_state(env, data, args.wasm_version);

    mutate_state(migrate_bucket_queues);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: whatever the two queues replaced in this release still hold for each bucket goes onto
// their replacement, the sync events then the vault ops, which had no ordering between them before.
// Sending is deferred while they're pushed, since a call can't be made from within post_upgrade.
// Removed, with the old queues, once this has run.
fn migrate_bucket_queues(state: &mut RuntimeState) {
    let now = state.env.now();
    let mut per_bucket: BTreeMap<CanisterId, Vec<StorageIndexEvent>> = BTreeMap::new();
    for (bucket, events) in state.data.bucket_event_sync_queue.take_all() {
        per_bucket
            .entry(bucket)
            .or_default()
            .extend(events.into_iter().map(|event| match event {
                EventToSync::UserAdded(user_id) => StorageIndexEvent::UserAdded(user_id),
                EventToSync::UserRemoved(user_id) => StorageIndexEvent::UserRemoved(user_id),
                EventToSync::AccessorRemoved(accessor_id) => StorageIndexEvent::AccessorRemoved(accessor_id),
                EventToSync::FileToRemove(file_id) => StorageIndexEvent::FileToRemove(file_id),
            }));
    }
    for (bucket, ops) in state.data.vault_event_sync_queue.take_all() {
        per_bucket
            .entry(bucket)
            .or_default()
            .extend(ops.into_iter().map(StorageIndexEvent::VaultOp));
    }
    let count: usize = per_bucket.values().map(|e| e.len()).sum();
    state.data.storage_bucket_event_sync_queue.set_defer_processing(true);
    for (bucket, events) in per_bucket {
        state.data.push_events_to_bucket(bucket, events, now, state.env.rng());
    }
    state.data.storage_bucket_event_sync_queue.set_defer_processing(false);
    info!(count, "Moved the pending bucket events onto the bucket events queue");
}
