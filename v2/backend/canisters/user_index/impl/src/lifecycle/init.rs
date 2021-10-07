use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use slog::info;
use slog_scope::with_logger;
use user_index_canister::init::Args;
use utils::env::canister::CanisterEnv;

#[init]
fn init(args: Args) {
    init_logger();
    ic_cdk::setup();

    let user_canister_wasm = args.user_canister_wasm.decompress();

    let env = Box::new(CanisterEnv::new(args.test_mode));
    let data = Data::new(
        args.service_principals,
        args.sms_service_principals,
        user_canister_wasm,
        args.group_index_canister_id,
        args.notifications_canister_id,
    );

    init_state(env, data);

    with_logger(|l| info!(l, "Initialization complete"));
}
