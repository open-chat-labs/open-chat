use crate::lifecycle::{init_env, init_state};
use crate::Data;
use canister_tracing_macros::trace;
use exchange_client_canister::init::Args;
use ic_cdk_macros::init;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id);

    let env = init_env();
    let data = Data::new(
        args.governance_principals.into_iter().collect(),
        args.cycles_dispenser_canister_id,
        args.icp_ledger_canister_id,
        args.chat_ledger_canister_id,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
