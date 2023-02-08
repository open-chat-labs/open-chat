use crate::lifecycle::{init_state, reseed_rng};
use crate::Data;
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use notifications_index_canister::init::Args;
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
    let data = Data::new(
        args.service_principals,
        args.push_service_principals,
        args.user_index_canister_id,
        args.cycles_dispenser_canister_id,
        args.notifications_canister_wasm,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    ic_cdk::timer::set_timer(Duration::default(), reseed_rng);

    info!(version = %args.wasm_version, "Initialization complete");
}
