use crate::canister::RUNTIME_STATE;
use crate::model::data::Data;
use crate::model::runtime_state::RuntimeState;
use candid::Principal;
use ic_cdk_macros::init;
use serde::Deserialize;
use shared::env::canister::CanisterEnv;

#[derive(Deserialize)]
struct InitArgs {
    push_service_principals: Vec<Principal>,
}

#[init]
fn init(args: InitArgs) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let data = Data::new(args.push_service_principals);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}
