use candid::Principal;
use crate::canister::RUNTIME_STATE;
use crate::canister::env::CanisterEnv;
use crate::model::data::Data;
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::init;
use serde::Deserialize;

#[init]
fn init(args: InitArgs) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(args.sms_service_principals, args.user_canister_wasm));
        let data = Data::default();
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}

#[derive(Deserialize)]
struct InitArgs {
    sms_service_principals: Vec<Principal>,
    user_canister_wasm: Vec<u8>,
}
