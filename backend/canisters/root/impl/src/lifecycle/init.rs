use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_api_macros::trace;
use ic_cdk_macros::init;
use root_canister::init::Args;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    ic_cdk::setup();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());

    let data = Data::new(
        args.service_principals.into_iter().collect(),
        args.user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_id,
        args.online_users_aggregator_canister_id,
        args.open_storage_index_canister_id,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
