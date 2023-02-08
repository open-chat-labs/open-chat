use crate::lifecycle::{init_state, reseed_rng};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use online_users_canister::init::Args;
use std::time::Duration;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id);

    let env = Box::<CanisterEnv>::default();
    let data = Data::new(args.user_index_canister_id, args.cycles_dispenser_canister_id, args.test_mode);

    init_state(env, data, args.wasm_version);

    ic_cdk::timer::set_timer(Duration::default(), reseed_rng);

    info!(version = %args.wasm_version, "Initialization complete");
}
