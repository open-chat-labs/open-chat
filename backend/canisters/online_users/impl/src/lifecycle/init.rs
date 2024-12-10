use crate::lifecycle::{init_env, init_state};
use crate::memory::get_stable_memory_map_memory;
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk::init;
use online_users_canister::init::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    stable_memory_map::init(get_stable_memory_map_memory());
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let data = Data::new(
        args.user_index_canister_id,
        args.event_relay_canister_id,
        args.cycles_dispenser_canister_id,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
