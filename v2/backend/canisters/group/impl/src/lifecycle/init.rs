use crate::{Data, RuntimeState, RUNTIME_STATE};
use group_canister::lifecycle::init::Args;
use ic_cdk_macros::init;
use shared::env::canister::CanisterEnv;
use shared::env::Environment;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let group_index_canister_id = env.caller();

        let data = Data::new(
            args.is_public,
            args.name,
            args.description,
            args.created_by_principal,
            args.created_by_user_id,
            env.now(),
            group_index_canister_id,
            args.wasm_version,
        );
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
