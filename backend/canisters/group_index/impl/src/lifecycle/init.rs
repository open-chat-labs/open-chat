use crate::Data;
use crate::lifecycle::init_state;
use canister_tracing_macros::trace;
use group_index_canister::init::Args;
use ic_cdk::init;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = Box::new(CanisterEnv::new(args.rng_seed));

    let data = Data::new(
        args.governance_principals,
        args.user_index_canister_id,
        args.cycles_dispenser_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.event_relay_canister_id,
        args.registry_canister_id,
        args.internet_identity_canister_id,
        args.video_call_operators,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
