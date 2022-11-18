use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use notifications_canister::init::Args;
use tracing::info;
use utils::consts::MIN_CYCLES_BALANCE;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    ic_cdk::setup();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let data = Data::new(args.push_service_principals, args.user_index_canister_id, args.test_mode);

    init_state(env, data, args.wasm_version);

    cycles_dispenser_client::init(args.cycles_dispenser_canister_id, 3 * MIN_CYCLES_BALANCE / 2);

    info!(version = %args.wasm_version, "Initialization complete");
}
