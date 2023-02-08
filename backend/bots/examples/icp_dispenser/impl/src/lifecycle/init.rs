use crate::lifecycle::{init_state, reseed_rng};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use icp_dispenser_bot::init::Args;
use std::time::Duration;
use tracing::info;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = Box::new(CanisterEnv::default());

    let data = Data::new(
        args.user_index_canister_id,
        args.admins.into_iter().collect(),
        env.canister_id(),
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    ic_cdk::timer::set_timer(Duration::default(), reseed_rng);

    info!(version = %args.wasm_version, "Initialization complete");
}
