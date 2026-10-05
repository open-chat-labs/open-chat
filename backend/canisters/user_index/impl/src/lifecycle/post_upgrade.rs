use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::updates::set_daily_puzzle_canister_id;
use crate::{Data, mutate_state, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
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

    // One-off: record the prod DailyPuzzle canister id and push it to every LocalUserIndex, in
    // place of a governance proposal. Run from a timer because the push makes c2c calls, which
    // can't be made from post_upgrade. Only release this once the DailyPuzzle canister has its
    // wasm, or each LocalUserIndex's puzzle pull fails and retries forever (see #9651).
    // TODO remove after the release containing this has been deployed
    if read_state(|state| !state.data.test_mode && state.data.daily_puzzle_canister_id.is_none()) {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            let canister_id = CanisterId::from_text("5cz5j-uiaaa-aaaaf-bsdda-cai").unwrap();
            mutate_state(|state| {
                set_daily_puzzle_canister_id::set_daily_puzzle_canister_id_impl(
                    user_index_canister::set_daily_puzzle_canister_id::Args { canister_id },
                    state,
                )
            });
        });
    }

    // One-off: point the new queue of migrated user ids at the StorageIndex, and queue every user
    // migrated so far, so that the storage buckets let the canisters now holding them delete the
    // files which name their old ids as accessors. They're queued from a timer because pushing to
    // the queue makes c2c calls. Only release this once every bucket has been upgraded to a version
    // which records them, since older buckets would ignore them.
    // TODO remove after the release containing this has been deployed
    mutate_state(|state| {
        let storage_index_canister_id = state.data.storage_index_canister_id;
        state
            .data
            .storage_index_user_ids_migrated_queue
            .set_state(storage_index_canister_id);
    });
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        mutate_state(|state| {
            let user_ids = state.data.migrated_user_ids.iter().collect();
            state.data.storage_index_user_ids_migrated_queue.push_many(user_ids);
        });
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
