use crate::client::create_canister;
use crate::env::ENV;
use crate::{TestEnv, client};
use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use pocket_ic::{PocketIc, RejectResponse};
use std::ops::Deref;
use types::CanisterId;

const CALL_RELAY_WAT: &str = include_str!("../../canisters/call_relay/call_relay.wat");

// The wasm to be embedded in the LocalUserIndex, built from the wat above
const CALL_RELAY_WASM: &[u8] = include_bytes!("../../canisters/call_relay/call_relay.wasm");

// A callee which replies with its args, or rejects with them as the message
const ECHO_WAT: &str = r#"
(module
  (import "ic0" "msg_arg_data_size" (func $msg_arg_data_size (result i32)))
  (import "ic0" "msg_arg_data_copy" (func $msg_arg_data_copy (param i32 i32 i32)))
  (import "ic0" "msg_reply_data_append" (func $msg_reply_data_append (param i32 i32)))
  (import "ic0" "msg_reply" (func $msg_reply))
  (import "ic0" "msg_reject" (func $msg_reject (param i32 i32)))
  (memory 40)
  (func $copy_args (result i32)
    (local $size i32)
    (local.set $size (call $msg_arg_data_size))
    (call $msg_arg_data_copy (i32.const 0) (i32.const 0) (local.get $size))
    (local.get $size))
  (func $echo
    (call $msg_reply_data_append (i32.const 0) (call $copy_args))
    (call $msg_reply))
  (func $reject
    (call $msg_reject (i32.const 0) (call $copy_args)))
  (export "canister_update echo" (func $echo))
  (export "canister_update reject" (func $reject)))
"#;

const ICP_TRANSFER_FEE: u128 = 10_000;

const CANISTER_REJECT: u32 = 4;
const CANISTER_ERROR: u32 = 5;

#[test]
fn call_relay_transfers_the_funds_held_by_the_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // An uninstalled user canister which still holds some ICP
    let canister_id = create_canister(env, *controller);
    let balance = 1_000_000_000;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, canister_id, balance);

    env.install_canister(canister_id, wasm(), vec![], Some(*controller));

    // The user's new account
    let recipient = Account::from(Principal::from_slice(&[1, 2, 3]));
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: recipient,
        fee: None,
        created_at_time: None,
        memo: None,
        amount: (balance - ICP_TRANSFER_FEE).into(),
    };
    let transfer = |env: &PocketIc| {
        let (reject_code, reply) = relay(
            env,
            *controller,
            canister_id,
            canister_ids.icp_ledger,
            "icrc1_transfer",
            &candid::encode_one(&transfer_args).unwrap(),
        )
        .unwrap();
        assert_eq!(reject_code, 0);
        candid::decode_one::<Result<Nat, TransferError>>(&reply).unwrap()
    };

    assert!(transfer(env).is_ok());
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, canister_id),
        0
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, recipient),
        balance - ICP_TRANSFER_FEE
    );

    // The ledger's error comes back in its reply like any other
    assert!(matches!(transfer(env), Err(TransferError::InsufficientFunds { .. })));

    // The canister can be uninstalled again afterwards
    env.uninstall_canister(canister_id, Some(*controller)).unwrap();
}

#[test]
fn call_relay_returns_the_callees_reply_or_reject_as_is() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let canister_id = create_canister(env, *controller);
    env.install_canister(canister_id, wasm(), vec![], Some(*controller));

    let echo = create_canister(env, *controller);
    env.install_canister(echo, wat::parse_str(ECHO_WAT).unwrap(), vec![], Some(*controller));

    // Large enough that the relay has to grow its memory to hold the args and then the reply
    for payload in [b"hello".to_vec(), vec![], (0..200_000).map(|i| i as u8).collect()] {
        assert_eq!(
            relay(env, *controller, canister_id, echo, "echo", &payload).unwrap(),
            (0, payload)
        );
    }

    assert_eq!(
        relay(env, *controller, canister_id, echo, "reject", b"no thanks").unwrap(),
        (CANISTER_REJECT, b"no thanks".to_vec())
    );

    let (reject_code, message) = relay(env, *controller, canister_id, echo, "missing", &[]).unwrap();
    assert_eq!(reject_code, CANISTER_ERROR);
    assert!(String::from_utf8(message).unwrap().contains("has no update method"));

    // An empty callee is the management canister
    let (reject_code, reply) = relay(
        env,
        *controller,
        canister_id,
        Principal::management_canister(),
        "raw_rand",
        &candid::encode_args(()).unwrap(),
    )
    .unwrap();
    assert_eq!(reject_code, 0);
    assert_eq!(candid::decode_one::<Vec<u8>>(&reply).unwrap().len(), 32);
}

#[test]
fn call_relay_rejects_callers_which_are_not_controllers() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let canister_id = create_canister(env, *controller);
    env.install_canister(canister_id, wasm(), vec![], Some(*controller));

    for caller in [Principal::anonymous(), Principal::from_slice(&[1, 2, 3])] {
        let error = relay(
            env,
            caller,
            canister_id,
            canister_ids.icp_ledger,
            "icrc1_transfer",
            &candid::encode_args(()).unwrap(),
        )
        .unwrap_err();
        assert!(error.reject_message.contains("caller is not a controller"), "{error:?}");
    }
}

#[test]
fn call_relay_rejects_invalid_args() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let canister_id = create_canister(env, *controller);
    env.install_canister(canister_id, wasm(), vec![], Some(*controller));

    for args in [
        vec![],
        // No method length
        vec![0],
        // Callee longer than a principal can be
        [vec![30], vec![1; 30], vec![0]].concat(),
        // Callee truncated
        vec![3, 1, 2],
        // Method truncated
        vec![0, 8, b'r', b'a', b'w'],
    ] {
        let error = env.update_call(canister_id, *controller, "relay", args).unwrap_err();
        assert!(error.reject_message.contains("invalid args"), "{error:?}");
    }
}

#[test]
fn committed_call_relay_wasm_matches_the_wat() {
    let from_wat = wat::parse_str(CALL_RELAY_WAT).unwrap();

    // The `wat` crate appends a "name" custom section (id 0) which `wat2wasm` doesn't emit,
    // otherwise the two are identical
    assert!(
        from_wat.starts_with(CALL_RELAY_WASM),
        "call_relay.wasm is out of date, rebuild it from the wat"
    );
    assert_eq!(from_wat.get(CALL_RELAY_WASM.len()), Some(&0));
}

fn wasm() -> Vec<u8> {
    CALL_RELAY_WASM.to_vec()
}

// Returns the callee's reject code (0 if it replied) and its reply or reject message
fn relay(
    env: &PocketIc,
    sender: Principal,
    canister_id: CanisterId,
    callee: Principal,
    method: &str,
    payload: &[u8],
) -> Result<(u32, Vec<u8>), RejectResponse> {
    let mut args = vec![callee.as_slice().len() as u8];
    args.extend_from_slice(callee.as_slice());
    args.push(method.len() as u8);
    args.extend_from_slice(method.as_bytes());
    args.extend_from_slice(payload);

    env.update_call(canister_id, sender, "relay", args).map(|reply| {
        let (reject_code, rest) = reply.split_at(4);
        (u32::from_le_bytes(reject_code.try_into().unwrap()), rest.to_vec())
    })
}
