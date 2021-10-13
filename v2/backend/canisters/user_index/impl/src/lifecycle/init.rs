use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use tracing::{info, instrument};
use user_index_canister::init::Args;
use utils::env::canister::CanisterEnv;

#[init]
#[instrument(level = "trace")]
fn init(args: Args) {
    init_logger(args.test_mode);
    ic_cdk::setup();

    let user_canister_wasm = args.user_canister_wasm.decompress();

    let env = Box::new(CanisterEnv::new(args.test_mode));
    let data = Data::new(
        args.service_principals,
        args.sms_service_principals,
        user_canister_wasm,
        args.group_index_canister_id,
        args.notifications_canister_id,
        args.test_mode,
    );

    init_state(env, data);

    info!("Initialization complete");
}
