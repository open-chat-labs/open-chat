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
        let env = Box::new(CanisterEnv::new(args.test_mode));
        let data = Data::new(args.service_principals, args.sms_service_principals, args.user_wasm_module);
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}

#[derive(Deserialize)]
struct InitArgs {
    // Only these principals can call update_wasm
    service_principals: Vec<Principal>,

    // Only these principals can call pending_sms_messages
    sms_service_principals: Vec<Principal>,

    // The initial wasm module for creating user canisters
    #[serde(with = "serde_bytes")]
    user_wasm_module: Vec<u8>,

    // Accepts confirmation code 123456
    test_mode: bool,
}
