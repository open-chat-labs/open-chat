use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use cycles_dispenser_canister::init::Args;
use ic_cdk_macros::init;
use ic_ledger_types::Tokens;
use tracing::info;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = init_env();

    let data = Data::new(
        args.governance_principals,
        args.canisters,
        args.max_top_up_amount,
        args.min_interval,
        args.min_cycles_balance,
        Tokens::from_e8s(args.icp_burn_amount_e8s),
        args.ledger_canister,
        args.cycles_minting_canister,
        env.now(),
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
