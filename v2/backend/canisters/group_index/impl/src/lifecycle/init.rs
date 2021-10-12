use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use group_index_canister::init::Args;
use ic_cdk_macros::init;
use tracing::{info, instrument, Level};
use utils::env::canister::CanisterEnv;

#[init]
#[instrument(level = "trace", skip_all)]
fn init(args: Args) {
    init_logger(if args.test_mode { Level::TRACE } else { Level::INFO });
    ic_cdk::setup();

    let group_canister_wasm = args.group_canister_wasm.decompress();

    let env = Box::new(CanisterEnv::new(false));
    let data = Data::new(
        args.service_principals,
        group_canister_wasm,
        args.notifications_canister_id,
        args.test_mode,
    );

    init_state(env, data);

    info!("Initialization complete");
}
