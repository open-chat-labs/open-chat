use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk::init;
use registry_canister::init::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let mut data = Data::new(
        args.governance_principals.into_iter().collect(),
        args.proposals_bot_canister_id,
        args.user_index_canister_id,
        args.sns_wasm_canister_id,
        args.cycles_dispenser_canister_id,
        args.test_mode,
    );

    data.add_icp_token_details(
        args.nns_ledger_canister_id,
        args.nns_root_canister_id,
        args.nns_governance_canister_id,
        args.nns_index_canister_id,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
