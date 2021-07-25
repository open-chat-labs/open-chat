use crate::canister::RUNTIME_STATE;
use crate::model::data::Data;
use crate::model::runtime_state::RuntimeState;
use candid::Principal;
use ic_cdk_macros::init;
use serde::Deserialize;
use shared::env::canister::CanisterEnv;
use shared::env::Environment;
use shared::types::{CanisterId, Version};

#[init]
fn init(args: InitArgs) {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new(false));
        let user_index_canister_id = env.caller();

        let data = Data::new(
            args.owner,
            user_index_canister_id,
            args.group_index_canister_id,
            args.notification_canister_ids,
            args.wasm_version,
        );
        let runtime_state = RuntimeState::new(env, data);

        *state.borrow_mut() = Some(runtime_state);
    });
}

#[derive(Deserialize)]
struct InitArgs {
    owner: Principal,
    group_index_canister_id: CanisterId,
    notification_canister_ids: Vec<CanisterId>,
    wasm_version: Version,
}
