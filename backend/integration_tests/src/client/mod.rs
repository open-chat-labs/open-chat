#![allow(dead_code)]
use crate::identity_tests::sign_in_with_email;
use crate::utils::tick_many;
use crate::{CanisterIds, T, User, UserAuth};
use candid::{CandidType, Principal};
use pocket_ic::{PocketIc, RejectResponse};
use rand::random;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::time::Duration;
use testing::rng::random_internet_identity_principal;
use types::{CanisterId, CanisterWasm, DiamondMembershipPlanDuration, HttpRequest, HttpResponse, SignedDelegation};

mod macros;

pub mod airdrop_bot;
pub mod community;
pub mod cycles_dispenser;
pub mod daily_puzzle;
pub mod escrow;
pub mod event_store;
pub mod group;
pub mod group_index;
pub mod identity;
pub mod ledger;
pub mod local_user_index;
pub mod multi_user;
pub mod notifications_index;
pub mod online_users;
pub mod openchat_installer;
pub mod registry;
pub mod sign_in_with_email;
pub mod storage_bucket;
pub mod storage_index;
pub mod user;
pub mod user_index;

pub const INIT_CYCLES_BALANCE: u128 = 1_000 * T;

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
    env.install_canister(
        canister_id,
        wasm.module.into(),
        candid::encode_one(&payload).unwrap(),
        Some(sender),
    )
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

// Registers the user in a MultiUser canister rather than in a canister of their own
pub fn register_user_in_multi_user_canister(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    register_user_with_options(env, canister_ids, None, true)
}

// Registers the user in the given LocalUserIndex's newest MultiUser canister, creating one if it has
// none
pub fn register_user_in_multi_user_canister_on(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    referral_code: Option<String>,
) -> User {
    let (auth_principal, public_key) = random_internet_identity_principal();
    register_user_internal(
        env,
        canister_ids,
        referral_code,
        auth_principal,
        public_key,
        Some(local_user_index),
        true,
    )
    .0
}

pub fn register_user_on_subnet(env: &mut PocketIc, canister_ids: &CanisterIds, subnet: Principal) -> User {
    let (auth_principal, public_key) = random_internet_identity_principal();
    let local_user_index = canister_ids
        .subnets
        .iter()
        .find(|s| s.subnet_id == subnet)
        .unwrap()
        .local_user_index;
    register_user_internal(
        env,
        canister_ids,
        None,
        auth_principal,
        public_key,
        Some(local_user_index),
        false,
    )
    .0
}

pub fn register_user_with_referrer(env: &mut PocketIc, canister_ids: &CanisterIds, referral_code: Option<String>) -> User {
    register_user_with_options(env, canister_ids, referral_code, false)
}

pub fn register_user_with_options(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    referral_code: Option<String>,
    use_multi_user_canister: bool,
) -> User {
    let (auth_principal, public_key) = random_internet_identity_principal();
    register_user_internal(
        env,
        canister_ids,
        referral_code,
        auth_principal,
        public_key,
        None,
        use_multi_user_canister,
    )
    .0
}

pub fn register_user_and_include_auth(env: &mut PocketIc, canister_ids: &CanisterIds) -> (User, UserAuth) {
    register_user_and_include_auth_with_options(env, canister_ids, false)
}

pub fn register_user_in_multi_user_canister_and_include_auth(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
) -> (User, UserAuth) {
    register_user_and_include_auth_with_options(env, canister_ids, true)
}

fn register_user_and_include_auth_with_options(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    use_multi_user_canister: bool,
) -> (User, UserAuth) {
    let (auth_principal, auth_public_key, auth_delegation) = sign_in_with_email(env, canister_ids);
    let (user, oc_public_key, oc_delegation) = register_user_internal(
        env,
        canister_ids,
        None,
        auth_principal,
        auth_public_key.clone(),
        None,
        use_multi_user_canister,
    );

    let user_auth = UserAuth {
        auth_public_key,
        auth_delegation,
        oc_public_key,
        oc_delegation,
    };

    (user, user_auth)
}

pub fn register_diamond_user(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
    let user = register_user(env, canister_ids);
    upgrade_user(
        &user,
        env,
        canister_ids,
        controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );
    user
}

pub fn upgrade_user(
    user: &User,
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    duration: DiamondMembershipPlanDuration,
    recurring: bool,
) {
    ledger::happy_path::transfer(env, controller, canister_ids.icp_ledger, user.user_id, 1_000_000_000);

    user_index::happy_path::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        duration,
        false,
        recurring,
    );

    tick_many(env, 4);
}

fn register_user_internal(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    referral_code: Option<String>,
    auth_principal: Principal,
    public_key: Vec<u8>,
    local_user_index: Option<CanisterId>,
    use_multi_user_canister: bool,
) -> (User, Vec<u8>, SignedDelegation) {
    let session_key = random::<[u8; 32]>().to_vec();
    let create_identity_result = identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key,
        session_key.clone(),
        true,
    );

    let delegation = identity::happy_path::get_delegation(
        env,
        auth_principal,
        canister_ids.identity,
        session_key,
        create_identity_result.expiration,
    );

    let local_user_index =
        local_user_index.unwrap_or_else(|| user_index::happy_path::user_registration_canister(env, canister_ids.user_index));

    let user = local_user_index::happy_path::register_user_with_referrer(
        env,
        Principal::self_authenticating(&create_identity_result.user_key),
        local_user_index,
        create_identity_result.user_key.clone(),
        referral_code,
        use_multi_user_canister,
    );

    (user, create_identity_result.user_key, delegation)
}

fn unwrap_response<R: CandidType + DeserializeOwned>(response: Result<Vec<u8>, RejectResponse>) -> R {
    match response {
        Ok(bytes) => candid::decode_one(&bytes).unwrap(),
        Err(error) => panic!("{error}"),
    }
}

pub fn unwrap_msgpack_response<R: DeserializeOwned>(response: Result<Vec<u8>, RejectResponse>) -> R {
    match response {
        Ok(bytes) => msgpack::deserialize_then_unwrap(&bytes),
        Err(error) => panic!("{error}"),
    }
}

pub fn http_request(env: &PocketIc, sender: Principal, canister_id: Principal, args: &HttpRequest) -> HttpResponse {
    execute_query(env, sender, canister_id, "http_request", args)
}

pub fn http_request_update(env: &mut PocketIc, sender: Principal, canister_id: Principal, args: &HttpRequest) -> HttpResponse {
    execute_update(env, sender, canister_id, "http_request_update", args)
}
