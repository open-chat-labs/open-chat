use crate::Data;
use crate::lifecycle::{init_env, init_state};
use canister_tracing_macros::trace;
use ic_cdk::init;
use neuron_controller_canister::init::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let data = Data::new(
        args.governance_principals,
        args.nns_governance_canister_id,
        args.nns_ledger_canister_id,
        args.cycles_minting_canister_id,
        args.cycles_dispenser_canister_id,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
