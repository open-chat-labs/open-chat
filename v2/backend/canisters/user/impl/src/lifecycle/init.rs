use crate::lifecycle::init_state;
use crate::Data;
use ic_cdk_macros::init;
use user_canister::init::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new(false));
    let user_index_canister_id = env.caller();

    let data = Data::new(
        args.owner,
        user_index_canister_id,
        args.group_index_canister_id,
        args.notification_canister_ids,
        args.wasm_version,
    );

    init_state(env, data);
}
