use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use tracing::info;
use user_index_canister::init::Args;
use utils::env::canister::CanisterEnv;

const CANISTER_POOL_TARGET_SIZE: u16 = 100;

#[init]
fn init(args: Args) {
    init_logger();
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new(args.test_mode));
    let user_canister_wasm = args.user_canister_wasm.decompress();
    let canister_pool_target_size = if args.test_mode { 5_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.service_principals,
        args.sms_service_principals,
        user_canister_wasm,
        args.group_index_canister_id,
        args.notifications_canister_id,
        canister_pool_target_size,
    );

    init_state(env, data);

    info!("Initialization complete");
}
