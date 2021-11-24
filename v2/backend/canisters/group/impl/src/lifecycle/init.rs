use crate::lifecycle::{init_logger, init_state};
use crate::Data;
use canister_api_macros::trace;
use canister_logger::set_panic_hook;
use group_canister::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    set_panic_hook();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
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
        args.user_index_canister_id,
        args.notifications_canister_ids,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!("Initialization complete");
}
