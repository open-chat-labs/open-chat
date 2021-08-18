use crate::{Data, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::init;
use notifications_canister::init::Args;
use shared::env::canister::CanisterEnv;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let data = Data::new(args.push_service_principals);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
