use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use tracing::{info, instrument};
use user_canister::init::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[instrument(level = "trace")]
fn init(args: Args) {
    init_logger(args.test_mode);
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());
    let user_index_canister_id = env.caller();

    let data = Data::new(
        args.owner,
        user_index_canister_id,
        args.group_index_canister_id,
        args.notification_canister_ids,
        args.wasm_version,
        env.now(),
        args.test_mode,
    );

    init_state(env, data);

    info!("Initialization complete");
}
