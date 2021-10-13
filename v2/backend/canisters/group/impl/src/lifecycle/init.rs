use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use group_canister::init::Args;
use ic_cdk_macros::init;
use tracing::{info, instrument};
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[instrument(level = "trace")]
fn init(args: Args) {
    init_logger(args.test_mode);
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new(false));
    let group_index_canister_id = env.caller();

    let data = Data::new(
        env.canister_id().into(),
        args.is_public,
        args.name,
        args.description,
        args.avatar,
        args.history_visible_to_new_joiners,
        args.created_by_principal,
        args.created_by_user_id,
        env.now(),
        args.mark_active_duration,
        group_index_canister_id,
        args.wasm_version,
        args.test_mode,
    );

    init_state(env, data);

    info!("Initialization complete");
}
