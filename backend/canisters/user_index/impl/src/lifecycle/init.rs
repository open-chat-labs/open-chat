use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use tracing::info;
use user_index_canister::init::Args;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);

    let data = Data::new(
        args.governance_principals,
        args.user_canister_wasm,
        args.local_user_index_canister_wasm,
        args.group_index_canister_id,
        args.notifications_index_canister_id,
        args.identity_canister_id,
        args.proposals_bot_canister_id,
        args.cycles_dispenser_canister_id,
        args.storage_index_canister_id,
        args.escrow_canister_id,
        args.event_relay_canister_id,
        args.nns_governance_canister_id,
        args.internet_identity_canister_id,
        args.translations_canister_id,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
