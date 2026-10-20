use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{Data, RuntimeState, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use escrow_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    mutate_state(migrate_status_change_notifications);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: moves the swaps still waiting for their status change to be sent onto the event queue,
// which sends each swap's latest status. A push normally sends at once, which a call made from within
// post_upgrade can't, so sending is deferred while they are pushed, and the queue's timer sends them
// next round. Removed, with the old queue, once this has run.
fn migrate_status_change_notifications(state: &mut RuntimeState) {
    state.data.status_change_event_queue.set_defer_processing(true);
    while let Some(swap_id) = state.data.notify_status_change_queue.pop() {
        state.notify_status_change(swap_id);
    }
    state.data.status_change_event_queue.set_defer_processing(false);
}
