use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use ic_cdk_macros::init;
use online_users_agg_canister::init::Args;
use tracing::{info, instrument};
use utils::env::canister::CanisterEnv;

#[init]
#[instrument(level = "trace")]
fn init(args: Args) {
    init_logger(args.test_mode);
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let data = Data::new(args.user_index_canister_id, args.test_mode);

    init_state(env, data);

    info!("Initialization complete");
}
