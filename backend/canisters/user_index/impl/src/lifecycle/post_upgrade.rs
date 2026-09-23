use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::updates::refund_deleted_user_cycles;
use crate::{Data, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
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

    // One-off: refund the cycles still held by users deleted before cycles were refunded on
    // deletion. The flag is only set once the canisters have been queued, so if this upgrade is
    // followed by another before that happens, it is simply retried after the next one.
    // The LocalUserIndexes must be upgraded first so that they can handle the refund events.
    // TODO remove after the release containing this has been deployed
    if !read_state(|state| state.data.deleted_user_cycles_refund_queued) {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            let response = refund_deleted_user_cycles::run().await;
            info!(?response, "Queued the cycles of previously deleted users to be refunded");
        });
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
