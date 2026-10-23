use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state};
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

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    mutate_state(sync_bridged_user_links);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: tells the LocalUserIndexes who each linked account is linked to, which they didn't keep
// before. A push normally sends at once, which a call made from within post_upgrade can't, so sending
// is deferred while the events are pushed, and the queue's timer sends them next round. Removed once
// this has run.
fn sync_bridged_user_links(state: &mut RuntimeState) {
    let links: Vec<_> = state.data.bridged_users.links().collect();
    state.data.local_user_index_event_sync_queue_v2.set_defer_processing(true);
    for &(user, linked_user_id) in &links {
        state.push_bridged_user_link(user, Some(linked_user_id));
    }
    state.data.local_user_index_event_sync_queue_v2.set_defer_processing(false);
    info!(count = links.len(), "Synced bridged users' links to the LocalUserIndexes");
}
