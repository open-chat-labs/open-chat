use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk::init;
use tracing::info;
use user_index_canister::init::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32], false);

    let data = Data::new(
        args.governance_principals,
        args.group_index_canister_id,
        args.notifications_index_canister_id,
        args.identity_canister_id,
        args.proposals_bot_canister_id,
        args.airdrop_bot_canister_id,
        args.online_users_canister_id,
        args.cycles_dispenser_canister_id,
        args.storage_index_canister_id,
        args.escrow_canister_id,
        args.event_relay_canister_id,
        args.nns_governance_canister_id,
        args.internet_identity_canister_id,
        args.translations_canister_id,
        args.video_call_operators,
        args.ic_root_key,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
