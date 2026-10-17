use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    migrate_sync_queues(&mut data);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: moves whatever the queues replaced in this release still hold onto their replacements,
// ahead of anything queued since the upgrade. A push normally sends at once, which a call made from
// within post_upgrade can't, so sending is deferred while the items are pushed, and the queues'
// timers send them next round. Removed, with the old queues, once this has run.
fn migrate_sync_queues(data: &mut Data) {
    data.identity_user_sync_queue.set_state(data.identity_canister_id);

    let queue = &mut data.local_user_index_event_sync_queue;
    queue.set_defer_processing(true);
    for (canister_id, events) in std::mem::take(&mut data.user_index_event_sync_queue).take_all() {
        queue.push_many(canister_id, events);
    }
    queue.set_defer_processing(false);

    let queue = &mut data.identity_user_sync_queue;
    queue.set_defer_processing(true);
    queue.push_many(std::mem::take(&mut data.identity_canister_user_sync_queue).into());
    queue.set_defer_processing(false);
}
