use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use community_canister::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = init_env();

    let data = Data::new(
        args.created_by_principal,
        args.created_by_user_id,
        args.is_public,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.permissions,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.local_group_index_canister_id,
        args.notifications_canister_id,
        args.proposals_bot_user_id,
        args.gate,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
