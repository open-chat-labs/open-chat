use crate::Data;
use crate::lifecycle::init_state;
use canister_tracing_macros::trace;
use ic_cdk::init;
use multi_user_canister::init::Args;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = Box::new(CanisterEnv::new(args.rng_seed));
    let data = Data::new(
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.rng_seed,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
