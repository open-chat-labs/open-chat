use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use constants::DAY_IN_MS;
use group_index_canister::post_upgrade::Args;
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

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        let one_year_ago = now.saturating_sub(365 * DAY_IN_MS);
        let public_active_in_last_year = state
            .data
            .public_groups
            .iter()
            .filter(|g| g.has_been_active_since(one_year_ago))
            .count();
        let private_active_in_last_year = state
            .data
            .private_groups
            .iter()
            .filter(|g| g.has_been_active_since(one_year_ago))
            .count();

        info!(
            private = private_active_in_last_year,
            public = public_active_in_last_year,
            "Number of groups active in the last year"
        );
    })
}
