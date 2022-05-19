use crate::lifecycle::{init_logger, init_state};
use crate::{mutate_state, Data};
use canister_api_macros::trace;
use ic_cdk_macros::init;
use tracing::info;
use user_index_canister::init::Args;
use utils::env::canister::CanisterEnv;

const CANISTER_POOL_TARGET_SIZE: u16 = 20;

#[init]
#[trace]
fn init(args: Args) {
    ic_cdk::setup();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let user_canister_wasm = args.user_canister_wasm.decompress();
    let canister_pool_target_size = if args.test_mode { 3_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.service_principals,
        args.sms_service_principals,
        user_canister_wasm,
        args.group_index_canister_id,
        args.notifications_canister_ids,
        args.online_users_aggregator_canister_id,
        args.callback_canister_id,
        args.open_storage_index_canister_id,
        args.ledger_canister_id,
        canister_pool_target_size,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        let now = state.env.now();
        state.data.users.register_openchat_bot(now);
    });

    info!(version = %args.wasm_version, "Initialization complete");
}
