use crate::lifecycle::{init_env, init_state};
use crate::{openchat_bot, Data};
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use tracing::info;
use user_canister::init::Args;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = init_env();

    let data = Data::new(
        args.owner,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_id,
        args.ledger_canister_id,
        args.username,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    openchat_bot::send_welcome_messages();

    info!(version = %args.wasm_version, "Initialization complete");
}
