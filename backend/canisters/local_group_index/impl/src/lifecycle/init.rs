use crate::Data;
use crate::lifecycle::{init_env, init_state};
use canister_tracing_macros::trace;
use ic_cdk::init;
use local_group_index_canister::init::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

const CANISTER_POOL_TARGET_SIZE: u16 = 20;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let canister_pool_target_size = if args.test_mode { 3_u16 } else { CANISTER_POOL_TARGET_SIZE };

    let data = Data::new(
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_id,
        args.cycles_dispenser_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.event_relay_canister_id,
        args.internet_identity_canister_id,
        args.video_call_operators,
        args.ic_root_key,
        canister_pool_target_size,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
