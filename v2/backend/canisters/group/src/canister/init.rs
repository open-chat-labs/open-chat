use crate::canister::RUNTIME_STATE;
use crate::model::data::Data;
use crate::model::runtime_state::RuntimeState;
use candid::Principal;
use ic_cdk_macros::init;
use serde::Deserialize;
use shared::env::canister::CanisterEnv;
use shared::env::Environment;
use shared::types::{UserId, Version};

#[derive(Deserialize)]
struct InitArgs {
    is_public: bool,
    name: String,
    created_by_principal: Principal,
    created_by_user_id: UserId,
    wasm_version: Version,
}

#[init]
fn init(args: InitArgs) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let group_index_canister_id = env.caller();

        let data = Data::new(
            args.is_public,
            args.name,
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
