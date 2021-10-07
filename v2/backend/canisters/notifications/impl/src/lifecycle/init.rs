use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use notifications_canister::init::Args;
use slog::info;
use slog_scope::with_logger;
use utils::env::canister::CanisterEnv;

#[init]
fn init(args: Args) {
    init_logger();
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new(false));
    let data = Data::new(args.push_service_principals);

    init_state(env, data);

    with_logger(|l| info!(l, "Initialization complete"));
}
