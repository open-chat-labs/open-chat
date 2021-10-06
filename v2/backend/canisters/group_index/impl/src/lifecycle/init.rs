use crate::lifecycle::init_state;
use crate::Data;
use group_index_canister::init::Args;
use ic_cdk_macros::init;
use utils::env::canister::CanisterEnv;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    let group_canister_wasm = args.group_canister_wasm.decompress();

    let env = Box::new(CanisterEnv::new(false));
    let data = Data::new(args.service_principals, group_canister_wasm, args.notifications_canister_id);

    init_state(env, data);
}
