use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use escrow_canister::init::Args;
use ic_cdk::init;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let data = Data::new(args.registry_canister_id, args.cycles_dispenser_canister_id, args.test_mode);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
