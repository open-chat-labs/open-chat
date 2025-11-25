use crate::Data;
use crate::lifecycle::{init_env, init_state};
use canister_tracing_macros::trace;
use ic_cdk::init;
use identity_canister::init::Args;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let data = Data::new(
        args.governance_principals.into_iter().collect(),
        args.user_index_canister_id,
        args.cycles_dispenser_canister_id,
        args.sign_in_with_email_canister_id,
        args.originating_canisters,
        args.skip_captcha_whitelist,
        args.ic_root_key,
        args.test_mode,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");
}
