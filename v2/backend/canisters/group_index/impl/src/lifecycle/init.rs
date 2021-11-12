use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_api_macros::trace;
use canister_logger::set_panic_hook;
use group_index_canister::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::env::canister::CanisterEnv;

const CANISTER_POOL_TARGET_SIZE: u16 = 100;

#[init]
#[trace]
fn init(args: Args) {
    set_panic_hook();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let group_canister_wasm = args.group_canister_wasm.decompress();
    let canister_pool_target_size = if args.test_mode { 0_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.service_principals,
        group_canister_wasm,
        args.notifications_canister_id,
        args.user_index_canister_id,
        canister_pool_target_size,
        args.test_mode,
    );

    init_state(env, data);

    info!("Initialization complete");
}
