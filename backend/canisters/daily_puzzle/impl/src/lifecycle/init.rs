use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::model::schedule::{default_schedule, test_schedule};
use crate::model::seed::splitmix64;
use canister_tracing_macros::trace;
use daily_puzzle_canister::init::Args;
use ic_cdk::init;
use tracing::{error, info};
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let schedule = if args.test_mode { test_schedule() } else { default_schedule() };
    let mut data = Data::new(
        args.registry_canister_id,
        args.user_index_canister_id,
        args.cycles_dispenser_canister_id,
        schedule,
        args.test_mode,
    );

    if args.test_mode {
        // No entropy is available inside init, and test environments want today's puzzle
        // straight away rather than after the rng has been seeded via a timer
        let now = env.now();
        data.master_seed = splitmix64(now);
        let number = Data::number_for(now);
        if data.generate_candidate(number).is_none() {
            error!(number, "No generator for today's scheduled game");
        }
    }

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
