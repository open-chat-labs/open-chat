use candid::Principal;
use crate::canister::RUNTIME_STATE;
use crate::canister::env::CanisterEnv;
use crate::domain::phone_index::PhoneIndex;
use crate::runtime_state::RuntimeState;
use crate::user_index_canister_client::UserIndexCanisterClient;
use ic_cdk_macros::init;

#[init]
fn init() {
    ic_cdk::setup();

    RUNTIME_STATE.with(|state| {
        let env = Box::new(CanisterEnv::new());
        let user_index_canister_client = UserIndexCanisterClient::new(Principal::anonymous());
        let phone_index = PhoneIndex::default();
        let runtime_state = RuntimeState::new(env, user_index_canister_client, phone_index);

        *state.borrow_mut() = Some(runtime_state);
    });
}