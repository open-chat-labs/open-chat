use crate::lifecycle::init_state;
use crate::Data;
use canister_tracing_macros::trace;
use group_prize_bot::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = Box::new(CanisterEnv::new());

    let data = Data::new(args.user_index_canister_id, args.admins.into_iter().collect(), args.test_mode);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
