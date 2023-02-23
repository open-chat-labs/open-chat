use crate::lifecycle::{init_cycles_dispenser_client, init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use storage_index_canister::init::Args;
use tracing::info;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(
        args.cycles_dispenser_config.canister_id,
        args.cycles_dispenser_config.min_cycles_balance,
    );

    let env = init_env();
    let data = Data::new(
        args.user_controllers,
        args.governance_principals,
        args.bucket_canister_wasm,
        args.cycles_dispenser_config,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
