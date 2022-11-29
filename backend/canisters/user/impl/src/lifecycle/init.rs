use crate::lifecycle::{init_logger, init_state};
use crate::{openchat_bot, Data};
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use tracing::info;
use user_canister::init::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    ic_cdk::setup();
    init_logger(args.test_mode);

    let env = Box::new(CanisterEnv::new());
    let user_index_canister_id = env.caller();

    let data = Data::new(
        args.owner,
        user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_ids,
        args.ledger_canister_id,
        args.username,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    openchat_bot::send_welcome_messages();

    info!(version = %args.wasm_version, "Initialization complete");
}
