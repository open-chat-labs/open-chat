use crate::canister::env::CanisterEnv;
use crate::canister::RUNTIME_STATE;
use crate::model::data::Data;
use crate::model::runtime_state::RuntimeState;
use candid::Principal;
use ic_cdk_macros::init;
use serde::Deserialize;

#[init]
fn init(args: InitArgs) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new());
        let data = Data::new(args.owner);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}

#[derive(Deserialize)]
struct InitArgs {
    owner: Principal,
}
