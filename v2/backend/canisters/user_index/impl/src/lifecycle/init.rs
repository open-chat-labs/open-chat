use crate::{Data, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::init;
use shared::env::canister::CanisterEnv;
use user_index_canister::lifecycle::init::Args;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(args.test_mode));
        let data = Data::new(args.service_principals, args.sms_service_principals, args.user_wasm_module);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
