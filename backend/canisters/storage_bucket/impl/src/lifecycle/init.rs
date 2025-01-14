use crate::lifecycle::{init_env, init_state};
use crate::memory::get_stable_memory_map_memory;
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk::init;
use storage_bucket_canister::init::Args;
use tracing::info;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    stable_memory_map::init(get_stable_memory_map_memory());

    let env = init_env([0; 32]);

    let index_canister_id = env.caller();

    let data = Data::new(index_canister_id, env.now(), args.test_mode);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
