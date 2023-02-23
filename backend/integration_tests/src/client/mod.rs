mod macros;

pub mod group;
pub mod group_index;
pub mod local_user_index;
pub mod notifications;
pub mod notifications_index;
pub mod online_users;
pub mod storage_bucket;
pub mod storage_index;
pub mod user;
pub mod user_index;

use candid::{CandidType, Principal};
use ic_state_machine_tests::{CanisterInstallMode, CanisterSettingsArgs, StateMachine};
use itertools::Itertools;
use serde::de::DeserializeOwned;
use types::{CanisterId, CanisterWasm};

const INIT_CYCLES_BALANCE: u128 = 1_000_000_000_000_000;

pub fn create_canister(env: &mut StateMachine, controllers: Option<Vec<Principal>>) -> CanisterId {
    let canister_id = env.create_canister_with_cycles(
        INIT_CYCLES_BALANCE.into(),
        Some(CanisterSettingsArgs::new(
            controllers.map(|c| c.into_iter().map_into().collect()),
            None,
            None,
            None,
        )),
    );
    canister_id.get().0
}

pub fn install_canister<P: CandidType>(env: &mut StateMachine, canister_id: CanisterId, wasm: CanisterWasm, payload: P) {
    env.install_wasm_in_mode(
        canister_id.as_slice().try_into().unwrap(),
        CanisterInstallMode::Install,
        wasm.module,
        candid::encode_one(&payload).unwrap(),
    )
    .unwrap();
}

pub fn start_canister(env: &mut StateMachine, sender: Principal, canister_id: CanisterId) {
    env.execute_ingress_as(
        sender.as_slice().try_into().unwrap(),
        Principal::management_canister().as_slice().try_into().unwrap(),
        "start_canister",
        candid::encode_one(StartStopArgs::new(canister_id)).unwrap(),
    )
    .unwrap();
}

pub fn stop_canister(env: &mut StateMachine, sender: Principal, canister_id: CanisterId) {
    env.execute_ingress_as(
        sender.as_slice().try_into().unwrap(),
        Principal::management_canister().as_slice().try_into().unwrap(),
        "stop_canister",
        candid::encode_one(StartStopArgs::new(canister_id)).unwrap(),
    )
    .unwrap();
}

pub fn execute_query<P: CandidType, R: CandidType + DeserializeOwned>(
    env: &StateMachine,
    sender: Principal,
    canister_id: CanisterId,
    method_name: impl ToString,
    payload: &P,
) -> R {
    let bytes = env
        .query_as(
            sender.as_slice().try_into().unwrap(),
            canister_id.as_slice().try_into().unwrap(),
            method_name,
            candid::encode_one(payload).unwrap(),
        )
        .unwrap()
        .bytes();

    candid::decode_one(&bytes).unwrap()
}

pub fn execute_update<P: CandidType, R: CandidType + DeserializeOwned>(
    env: &mut StateMachine,
    sender: Principal,
    canister_id: CanisterId,
    method_name: impl ToString,
    payload: &P,
) -> R {
    let bytes = env
        .execute_ingress_as(
            sender.as_slice().try_into().unwrap(),
            canister_id.as_slice().try_into().unwrap(),
            method_name,
            candid::encode_one(payload).unwrap(),
        )
        .unwrap()
        .bytes();

    candid::decode_one(&bytes).unwrap()
}

#[derive(CandidType)]
struct StartStopArgs {
    canister_id: CanisterId,
}

impl StartStopArgs {
    fn new(canister_id: CanisterId) -> StartStopArgs {
        StartStopArgs { canister_id }
    }
}
