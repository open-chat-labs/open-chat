use crate::{Data, RuntimeState, RUNTIME_STATE};
use group_index_canister::lifecycle::init::Args;
use ic_cdk_macros::init;
use shared::env::canister::CanisterEnv;

#[init]
fn init(args: Args) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let data = Data::new(args.group_canister_wasm, args.notifications_canister_id);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
