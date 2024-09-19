#![allow(dead_code)]
use crate::utils::tick_many;
use crate::{CanisterIds, User, T};
use candid::{CandidType, Principal};
use pocket_ic::{PocketIc, UserError, WasmResult};
use rand::random;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::time::Duration;
use testing::rng::random_internet_identity_principal;
use types::{CanisterId, CanisterWasm, DiamondMembershipPlanDuration};

mod macros;

pub mod airdrop_bot;
pub mod community;
pub mod cycles_dispenser;
pub mod escrow;
pub mod event_store;
pub mod group;
pub mod group_index;
pub mod identity;
pub mod ledger;
pub mod local_user_index;
pub mod notifications;
pub mod notifications_index;
pub mod online_users;
pub mod registry;
pub mod sign_in_with_email;
pub mod storage_bucket;
pub mod storage_index;
pub mod user;
pub mod user_index;

const INIT_CYCLES_BALANCE: u128 = 1_000 * T;

pub fn create_canister(env: &mut PocketIc, controller: Principal) -> CanisterId {
    let canister_id = env.create_canister_with_settings(Some(controller), None);
    env.add_cycles(canister_id, INIT_CYCLES_BALANCE);
    canister_id
}

pub fn create_canister_with_id(env: &mut PocketIc, controller: Principal, canister_id: &str) -> CanisterId {
    let canister_id = canister_id.try_into().expect("Invalid canister ID");
    env.create_canister_with_id(Some(controller), None, canister_id)
        .expect("Create canister with ID failed");
    env.add_cycles(canister_id, INIT_CYCLES_BALANCE);
    canister_id
}

pub fn start_canister(env: &mut PocketIc, sender: Principal, canister_id: CanisterId) {
    env.start_canister(canister_id, Some(sender)).unwrap();
}

pub fn stop_canister(env: &mut PocketIc, sender: Principal, canister_id: CanisterId) {
    env.stop_canister(canister_id, Some(sender)).unwrap();
}

pub fn install_canister<P: CandidType>(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    wasm: CanisterWasm,
    payload: P,
) {
    env.advance_time(Duration::from_millis(1));
    env.install_canister(canister_id, wasm.module, candid::encode_one(&payload).unwrap(), Some(sender))
}

pub fn execute_query<P: CandidType, R: CandidType + DeserializeOwned>(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    payload: &P,
) -> R {
    unwrap_response(env.query_call(canister_id, sender, method_name, candid::encode_one(payload).unwrap()))
}

pub fn execute_msgpack_query<P: Serialize, R: DeserializeOwned>(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    payload: &P,
) -> R {
    unwrap_msgpack_response(env.query_call(canister_id, sender, method_name, msgpack::serialize_then_unwrap(payload)))
}

pub fn execute_update<P: CandidType, R: CandidType + DeserializeOwned>(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    payload: &P,
) -> R {
    unwrap_response(env.update_call(canister_id, sender, method_name, candid::encode_one(payload).unwrap()))
}

pub fn execute_msgpack_update<P: Serialize, R: DeserializeOwned>(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    payload: &P,
) -> R {
    unwrap_msgpack_response(env.update_call(canister_id, sender, method_name, msgpack::serialize_then_unwrap(payload)))
}

pub fn execute_update_no_response<P: CandidType>(
    env: &mut PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    method_name: &str,
    payload: &P,
) {
    env.update_call(canister_id, sender, method_name, candid::encode_one(payload).unwrap())
        .unwrap();
}

pub fn register_user(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    register_user_with_referrer(env, canister_ids, None)
}

pub fn register_user_with_referrer(env: &mut PocketIc, canister_ids: &CanisterIds, referral_code: Option<String>) -> User {
    let (auth_principal, public_key) = random_internet_identity_principal();
    let session_key = random::<[u8; 32]>().to_vec();
    let create_identity_result =
        identity::happy_path::create_identity(env, auth_principal, canister_ids.identity, public_key, session_key, true);

    local_user_index::happy_path::register_user_with_referrer(
        env,
        Principal::self_authenticating(&create_identity_result.user_key),
        canister_ids.local_user_index,
        create_identity_result.user_key,
        referral_code,
    )
}

pub fn register_diamond_user(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
    let user = register_user(env, canister_ids);
    upgrade_user(&user, env, canister_ids, controller, DiamondMembershipPlanDuration::OneMonth);
    user
}

pub fn upgrade_user(
    user: &User,
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    duration: DiamondMembershipPlanDuration,
) {
    ledger::happy_path::transfer(env, controller, canister_ids.icp_ledger, user.user_id, 1_000_000_000);

    user_index::happy_path::pay_for_diamond_membership(env, user.principal, canister_ids.user_index, duration, false, true);

    tick_many(env, 4);
}

fn unwrap_response<R: CandidType + DeserializeOwned>(response: Result<WasmResult, UserError>) -> R {
    match response.unwrap() {
        WasmResult::Reply(bytes) => candid::decode_one(&bytes).unwrap(),
        WasmResult::Reject(error) => panic!("{error}"),
    }
}

fn unwrap_msgpack_response<R: DeserializeOwned>(response: Result<WasmResult, UserError>) -> R {
    match response.unwrap() {
        WasmResult::Reply(bytes) => msgpack::deserialize_then_unwrap(&bytes),
        WasmResult::Reject(error) => panic!("{error}"),
    }
}
