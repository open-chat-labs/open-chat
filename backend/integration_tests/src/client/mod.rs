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
use types::{
    CanisterId, CanisterWasm, CryptoTransaction, DiamondMembershipPlanDuration, HttpRequest, HttpResponse,
    MessageContentInitial, PendingCryptoTransaction, SignedDelegation, icrc2,
};

mod macros;

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
pub mod proposals_bot;
pub mod registry;
pub mod sign_in_with_email;
pub mod storage_bucket;
pub mod storage_index;
pub mod translations;
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

// Users are registered into MultiUser canisters. The `_in_user_canister` variants instead give the
// user a canister of their own, which only the tests of User canisters themselves need.
pub fn register_user(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    register_user_with_referrer(env, canister_ids, None)
}

pub fn register_user_in_user_canister(env: &mut PocketIc, canister_ids: &CanisterIds) -> User {
    register_user_in_user_canister_with_referrer(env, canister_ids, None)
}

pub fn register_user_with_referrer(env: &mut PocketIc, canister_ids: &CanisterIds, referral_code: Option<String>) -> User {
    register_user_with_options(env, canister_ids, referral_code, None, true)
}

pub fn register_user_in_user_canister_with_referrer(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    referral_code: Option<String>,
) -> User {
    register_user_with_options(env, canister_ids, referral_code, None, false)
}

pub fn register_user_on_subnet(env: &mut PocketIc, canister_ids: &CanisterIds, subnet: Principal) -> User {
    register_user_with_referrer_on(env, canister_ids, local_user_index_on_subnet(canister_ids, subnet), None)
}

pub fn register_user_in_user_canister_on_subnet(env: &mut PocketIc, canister_ids: &CanisterIds, subnet: Principal) -> User {
    register_user_in_user_canister_with_referrer_on(env, canister_ids, local_user_index_on_subnet(canister_ids, subnet), None)
}

pub fn register_user_with_referrer_on(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    referral_code: Option<String>,
) -> User {
    register_user_with_options(env, canister_ids, referral_code, Some(local_user_index), true)
}

pub fn register_user_in_user_canister_with_referrer_on(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    referral_code: Option<String>,
) -> User {
    register_user_with_options(env, canister_ids, referral_code, Some(local_user_index), false)
}

// Registers the user in the given MultiUser canister on the given LocalUserIndex
pub fn register_user_in_multi_user_canister_on(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    local_user_index: CanisterId,
    multi_user_canister_id: CanisterId,
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
        Some(multi_user_canister_id),
    )
    .0
}

// Registers the user in a MultiUser canister created for them, which holds no one else, so that it can
// be stopped, eg. to fail calls to it, without affecting other users
pub fn register_user_in_new_multi_user_canister(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    platform_operator: Principal,
) -> User {
    let local_user_index = user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        user_index::happy_path::create_multi_user_canister(env, platform_operator, canister_ids, local_user_index);
    register_user_in_multi_user_canister_on(env, canister_ids, local_user_index, canister_id, None)
}

fn local_user_index_on_subnet(canister_ids: &CanisterIds, subnet: Principal) -> CanisterId {
    canister_ids
        .subnets
        .iter()
        .find(|s| s.subnet_id == subnet)
        .unwrap()
        .local_user_index
}

fn register_user_with_options(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    referral_code: Option<String>,
    local_user_index: Option<CanisterId>,
    use_multi_user_canister: bool,
) -> User {
    let (auth_principal, public_key) = random_internet_identity_principal();
    register_user_internal(
        env,
        canister_ids,
        referral_code,
        auth_principal,
        public_key,
        local_user_index,
        use_multi_user_canister,
        None,
    )
    .0
}

pub fn register_user_and_include_auth(env: &mut PocketIc, canister_ids: &CanisterIds) -> (User, UserAuth) {
    register_user_and_include_auth_with_options(env, canister_ids, true)
}

pub fn register_user_in_user_canister_and_include_auth(env: &mut PocketIc, canister_ids: &CanisterIds) -> (User, UserAuth) {
    register_user_and_include_auth_with_options(env, canister_ids, false)
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
        None,
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
    make_diamond(&user, env, canister_ids, controller);
    user
}

pub fn register_diamond_user_in_user_canister(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> User {
    let user = register_user_in_user_canister(env, canister_ids);
    make_diamond(&user, env, canister_ids, controller);
    user
}

fn make_diamond(user: &User, env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) {
    upgrade_user(
        user,
        env,
        canister_ids,
        controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );
}

pub fn upgrade_user(
    user: &User,
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    duration: DiamondMembershipPlanDuration,
    recurring: bool,
) {
    ledger::happy_path::transfer(env, controller, canister_ids.icp_ledger, user, 1_000_000_000);
    approve_user_canister(env, user, canister_ids.icp_ledger, 900_000_000);

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

// Lets the user's canister pull payments from their wallet, as the website does before a payment. A
// user in a MultiUser canister holds their own funds, so approves their canister to spend them, under
// their own spender subaccount. A user alone in their canister needs no approval, since the funds are
// its own.
pub fn approve_user_canister(env: &mut PocketIc, user: &User, ledger_canister_id: CanisterId, amount: u128) {
    if user.user_id.index() != 0 {
        approve_spender(env, user, ledger_canister_id, user.canister(), amount);
    }
}

// Approves `spender` to pull up to `amount` from the user's wallet, under the user's own spender
// subaccount, which is the only approval a canister spends for them
pub fn approve_spender(env: &mut PocketIc, user: &User, ledger_canister_id: CanisterId, spender: CanisterId, amount: u128) {
    ledger::happy_path::approve(
        env,
        user.principal,
        ledger_canister_id,
        icrc_ledger_types::icrc1::account::Account {
            owner: spender,
            subaccount: Some(ledger_utils::spender_subaccount(user.principal)),
        },
        amount,
    );
}

// Readies a message's transfer to be pulled from the user's wallet by `spender`, as the website does
// for a user in a MultiUser canister, who holds their own funds: an ICRC1 transfer is made an ICRC2
// one from their wallet, and `spender` is approved to pull it. Content without a transfer, or for a
// user alone in their canister, which pays from its own account, is returned as it is.
pub fn pay_from_wallet(
    env: &mut PocketIc,
    user: &User,
    spender: CanisterId,
    content: MessageContentInitial,
) -> MessageContentInitial {
    if user.user_id.index() == 0 {
        return content;
    }
    let (content, ledger, allowance) = match content {
        // A transfer from another account is approved by that account
        MessageContentInitial::Crypto(c) if !from_wallet(&c.transfer, user.principal) => {
            return MessageContentInitial::Crypto(c);
        }
        MessageContentInitial::Prize(p) if !from_wallet(&p.transfer, user.principal) => return MessageContentInitial::Prize(p),
        MessageContentInitial::Crypto(mut c) => {
            let (transfer, ledger, allowance) = transfer_from_wallet(c.transfer, user.principal);
            c.transfer = transfer;
            (MessageContentInitial::Crypto(c), ledger, allowance)
        }
        MessageContentInitial::Prize(mut p) => {
            let (transfer, ledger, allowance) = transfer_from_wallet(p.transfer, user.principal);
            p.transfer = transfer;
            (MessageContentInitial::Prize(p), ledger, allowance)
        }
        // A swap funded from another account is approved by that account
        MessageContentInitial::P2PSwap(p) if p.from_account.is_some() => return MessageContentInitial::P2PSwap(p),
        // The swap's deposit is its amount plus a fee, and pulling it costs another fee
        MessageContentInitial::P2PSwap(p) => {
            let (ledger, allowance) = (p.token0.ledger, p.token0_amount + 2 * p.token0.fee);
            (MessageContentInitial::P2PSwap(p), ledger, allowance)
        }
        content => return content,
    };
    approve_spender(env, user, ledger, spender, allowance);
    content
}

// Whether the transfer is from the wallet of `principal`, as an ICRC1 one always is. The wallet is the
// default subaccount, which can also be given explicitly as all zeros.
fn from_wallet(transfer: &CryptoTransaction, principal: Principal) -> bool {
    match transfer {
        CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(t)) => {
            t.from.owner == principal && t.from.subaccount.is_none_or(|s| s == [0; 32])
        }
        _ => true,
    }
}

// The transfer as an ICRC2 one from `from`'s wallet, along with its ledger and the allowance needed to
// pull it, being its amount plus the fee
fn transfer_from_wallet(transfer: CryptoTransaction, from: Principal) -> (CryptoTransaction, CanisterId, u128) {
    let transfer = match transfer {
        CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(t)) => icrc2::PendingCryptoTransaction {
            ledger: t.ledger,
            token_symbol: t.token_symbol,
            amount: t.amount,
            from: from.into(),
            to: t.to,
            fee: t.fee,
            memo: t.memo,
            created: t.created,
        },
        CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(t)) => t,
        transfer => panic!("Unexpected transfer: {transfer:?}"),
    };
    let (ledger, allowance) = (transfer.ledger, transfer.amount + transfer.fee);
    (
        CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(transfer)),
        ledger,
        allowance,
    )
}

#[expect(clippy::too_many_arguments)]
fn register_user_internal(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    referral_code: Option<String>,
    auth_principal: Principal,
    public_key: Vec<u8>,
    local_user_index: Option<CanisterId>,
    use_multi_user_canister: bool,
    multi_user_canister_id: Option<CanisterId>,
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
        multi_user_canister_id,
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
