use crate::{Data, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::init;
use shared::env::canister::CanisterEnv;

#[init]
fn init() {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let data = Data::default();
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
