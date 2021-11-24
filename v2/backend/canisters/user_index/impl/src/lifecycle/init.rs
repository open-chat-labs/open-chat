use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_api_macros::trace;
use canister_logger::set_panic_hook;
use ic_cdk_macros::init;
use tracing::info;
use user_index_canister::init::Args;
use utils::env::canister::CanisterEnv;

const CANISTER_POOL_TARGET_SIZE: u16 = 100;

#[init]
#[trace]
fn init(args: Args) {
    set_panic_hook();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let user_canister_wasm = args.user_canister_wasm.decompress();
    let canister_pool_target_size = if args.test_mode { 0_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.service_principals,
        args.sms_service_principals,
        user_canister_wasm,
        args.group_index_canister_id,
        args.notifications_canister_ids,
        args.online_users_aggregator_canister_id,
        canister_pool_target_size,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!("Initialization complete");
}
