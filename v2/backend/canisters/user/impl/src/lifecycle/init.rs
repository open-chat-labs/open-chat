use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_api_macros::trace;
use canister_logger::set_panic_hook;
use ic_cdk_macros::init;
use tracing::info;
use user_canister::init::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    set_panic_hook();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let user_index_canister_id = env.caller();

    let data = Data::new(
        args.owner,
        user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_ids,
        env.now(),
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!("Initialization complete");
}
