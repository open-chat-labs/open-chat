use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use group_index_canister::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::consts::MIN_CYCLES_BALANCE;
use utils::env::canister::CanisterEnv;

const CANISTER_POOL_TARGET_SIZE: u16 = 20;

#[init]
#[trace]
fn init(args: Args) {
    ic_cdk::setup();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let canister_pool_target_size = if args.test_mode { 0_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.service_principals,
        args.group_canister_wasm,
        args.notifications_canister_ids,
        args.user_index_canister_id,
        args.callback_canister_id,
        canister_pool_target_size,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    cycles_dispenser_client::init(args.cycles_dispenser_canister_id, 2 * MIN_CYCLES_BALANCE);

    info!(version = %args.wasm_version, "Initialization complete");
}
