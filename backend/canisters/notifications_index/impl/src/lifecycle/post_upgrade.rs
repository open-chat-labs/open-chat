use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use notifications_index_canister::post_upgrade::Args;
use rand::RngCore;
use stable_memory::get_reader;
use tracing::info;
use types::IdempotentMessage;
use utils::cycles::init_cycles_dispenser_client;

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
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        let now = state.env.now();
        // Move all queued events from the previous queue to the new one
        #[allow(deprecated)]
        let previous_queue = std::mem::take(&mut state.data.notifications_index_event_sync_queue);
        state.data.notification_canisters_event_sync_queue.set_defer_processing(true);
        for (canister_id, events) in previous_queue.take_all() {
            state.data.notification_canisters_event_sync_queue.push_many(
                canister_id,
                events
                    .into_iter()
                    .map(|e| IdempotentMessage {
                        created_at: now,
                        idempotency_id: state.env.rng().next_u64(),
                        value: e,
                    })
                    .collect(),
            );
        }
        state.data.notification_canisters_event_sync_queue.set_defer_processing(false);
    })
}
