use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use notifications_canister::init::Args;
use tracing::{info, instrument, Level};
use utils::env::canister::CanisterEnv;

#[init]
#[instrument(level = "trace", skip_all)]
fn init(args: Args) {
    init_logger(if args.test_mode { Level::TRACE } else { Level::INFO });
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new(false));
    let data = Data::new(args.push_service_principals, args.test_mode);

    init_state(env, data);

    info!("Initialization complete");
}
