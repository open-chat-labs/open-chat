use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{RuntimeState, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use timer_job_queues::BatchedTimerJobQueue;
use tracing::info;
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

    mutate_state(migrate_daily_puzzle_results);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// One-off: the results still to be reported by the queue this release replaces go via its
// replacement, which only sets a timer when pushed to, since it defers sending.
// TODO: remove once released
fn migrate_daily_puzzle_results(state: &mut RuntimeState) {
    let Some(mut old_queue) = state.data.daily_puzzle_results_queue.take() else {
        return;
    };
    let results = old_queue.take_all();
    if let Some(canister_id) = state.data.daily_puzzle_canister_id
        && state.data.daily_puzzle_event_sync_queue.is_none()
    {
        state.data.daily_puzzle_event_sync_queue = Some(BatchedTimerJobQueue::new(canister_id, true));
    }
    let count = results.len();
    for result in results {
        state.push_daily_puzzle_result(result);
    }
    info!(count, "Moved the pending daily puzzle results onto the events queue");
}
