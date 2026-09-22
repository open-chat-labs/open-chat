use crate::env::ENV;
use crate::utils::{chat_token_info, icp_token_info, now_millis, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::RawMessageId;
use std::ops::Deref;
use std::str::FromStr;
use std::time::Duration;
use test_case::test_case;
use types::{CanisterId, Chat, P2PSwapLocation, UserId};

#[test]
fn swap_via_escrow_canister_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let now = now_millis(env);

    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;

    let swap_id = client::escrow::happy_path::create_swap(
        env,
        user1.user_id.canister_id(),
        canister_ids.escrow,
        P2PSwapLocation::from_message(Chat::Direct(user2.user_id.into()), None, 0u64.into()),
        icp_token_info(),
        icp_amount,
        None,
        chat_token_info(),
        chat_amount,
        None,
        now + DAY_IN_MS,
    );

    let user1_deposit_account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user1.user_id.as_principal(), swap_id)),
    };

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1_deposit_account,
        icp_amount + 10_000,
    );

    let user2_deposit_account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user2.user_id.as_principal(), swap_id)),
    };

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user2_deposit_account,
        chat_amount + 100_000,
    );

    let result1 =
        client::escrow::happy_path::notify_deposit(env, user1.user_id.canister_id(), canister_ids.escrow, swap_id, None);
    let result2 =
        client::escrow::happy_path::notify_deposit(env, user2.user_id.canister_id(), canister_ids.escrow, swap_id, None);

    assert!(!result1.complete);
    assert!(result2.complete);

    tick_many(env, 5);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        chat_amount
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        icp_amount
    );
}

#[test]
fn external_swap_via_escrow_canister_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let sender = Principal::from_slice(&[1]);
    let offerer = Principal::from_slice(&[2]);
    let accepter = Principal::from_slice(&[3]);

    let now = now_millis(env);

    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;

    let swap_id = client::escrow::happy_path::create_swap(
        env,
        sender,
        canister_ids.escrow,
        P2PSwapLocation::External,
        icp_token_info(),
        icp_amount,
        Some(offerer),
        chat_token_info(),
        chat_amount,
        Some(accepter),
        now + DAY_IN_MS,
    );

    let swap = client::escrow::happy_path::lookup_swap(env, sender, canister_ids.escrow, swap_id, Some(accepter));

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Account::from_str(swap.token0_deposit_address.as_str()).unwrap(),
        icp_amount + 10_000,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Account::from_str(swap.token1_deposit_address.unwrap().as_str()).unwrap(),
        chat_amount + 100_000,
    );

    let result1 = client::escrow::happy_path::notify_deposit(env, sender, canister_ids.escrow, swap_id, Some(offerer));
    let result2 = client::escrow::happy_path::notify_deposit(env, sender, canister_ids.escrow, swap_id, Some(accepter));

    assert!(!result1.complete);
    assert!(result2.complete);

    tick_many(env, 5);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, offerer),
        chat_amount
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, accepter),
        icp_amount
    );
}

#[test_case(true)]
#[test_case(false)]
fn deposits_refunded_if_swap_no_longer_available(expired: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let now = now_millis(env);

    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;

    let swap_id = client::escrow::happy_path::create_swap(
        env,
        user1.user_id.canister_id(),
        canister_ids.escrow,
        P2PSwapLocation::from_message(Chat::Direct(user2.user_id.into()), None, 0u64.into()),
        icp_token_info(),
        icp_amount,
        None,
        chat_token_info(),
        chat_amount,
        None,
        now + HOUR_IN_MS,
    );

    let user1_deposit_account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user1.user_id.as_principal(), swap_id)),
    };

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1_deposit_account,
        icp_amount + 10_000,
    );

    let user2_deposit_account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user2.user_id.as_principal(), swap_id)),
    };

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user2_deposit_account,
        chat_amount + 100_000,
    );

    client::escrow::happy_path::notify_deposit(env, user1.user_id.canister_id(), canister_ids.escrow, swap_id, None);

    if expired {
        env.advance_time(Duration::from_millis((60 * MINUTE_IN_MS) + 1));
    } else {
        client::escrow::happy_path::cancel_swap(env, user1.user_id.canister_id(), canister_ids.escrow, swap_id);
    }

    let notify_response = client::escrow::notify_deposit(
        env,
        user2.user_id.canister_id(),
        canister_ids.escrow,
        &escrow_canister::notify_deposit::Args {
            swap_id,
            deposited_by: None,
        },
    );

    if expired {
        assert!(matches!(
            notify_response,
            escrow_canister::notify_deposit::Response::SwapExpired
        ));
    } else {
        assert!(matches!(
            notify_response,
            escrow_canister::notify_deposit::Response::SwapCancelled
        ));
    };

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id),
        icp_amount
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id),
        chat_amount
    );
}

// A deposit is checked against the ledger before it is recorded, so the swap can end while the
// check is in flight. The deposit must then be refunded rather than recorded against a swap which
// has nothing left to refund it. Expiry is used to end the swap since its timer runs ahead of the
// ledger's reply; a cancellation arriving as a new message is handled after the reply, but takes
// the same path when it does land in between.
#[test]
fn deposit_is_refunded_if_swap_expires_while_it_is_checked() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let icp_amount = 100_000_000_000;
    let swap_id = create_icp_for_chat_swap(env, canister_ids, &user1, &user2, icp_amount, 1_000_000_000_000);
    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user1.user_id,
        canister_ids.icp_ledger,
        icp_amount + 10_000,
    );

    // One round starts the check, which then waits on the ledger while the swap expires
    let message_id = submit_notify_deposit(env, canister_ids.escrow, swap_id, user1.user_id);
    env.tick();
    env.advance_time(Duration::from_millis(HOUR_IN_MS + 1));
    env.tick();

    let response = await_notify_deposit(env, message_id);
    assert!(
        matches!(response, escrow_canister::notify_deposit::Response::SwapExpired),
        "{response:?}"
    );

    tick_many(env, 10);

    // The deposit went back, less the fee for returning it
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id),
        icp_amount
    );
}

// Two users accepting at once each have their deposit checked, and only the first to be checked is
// accepted. The other's deposit is refunded rather than taking over the swap.
#[test]
fn only_one_of_two_users_accepting_at_once_is_accepted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);
    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;
    // Open to anyone, so that both may accept
    let swap_id = client::escrow::happy_path::create_swap(
        env,
        user1.user_id.canister_id(),
        canister_ids.escrow,
        P2PSwapLocation::from_message(Chat::Direct(user2.user_id.into()), None, 0u64.into()),
        icp_token_info(),
        icp_amount,
        None,
        chat_token_info(),
        chat_amount,
        None,
        now_millis(env) + HOUR_IN_MS,
    );
    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user1.user_id,
        canister_ids.icp_ledger,
        icp_amount + 10_000,
    );
    client::escrow::happy_path::notify_deposit(env, user1.user_id.canister_id(), canister_ids.escrow, swap_id, None);

    for user in [&user2, &user3] {
        deposit(
            env,
            canister_ids,
            *controller,
            swap_id,
            user.user_id,
            canister_ids.chat_ledger,
            chat_amount + 100_000,
        );
    }
    let message_ids: Vec<_> = [&user2, &user3]
        .into_iter()
        .map(|user| submit_notify_deposit(env, canister_ids.escrow, swap_id, user.user_id))
        .collect();
    let responses: Vec<_> = message_ids.into_iter().map(|id| await_notify_deposit(env, id)).collect();

    let (winner, loser) = match responses.as_slice() {
        [
            escrow_canister::notify_deposit::Response::Success(_),
            escrow_canister::notify_deposit::Response::SwapAlreadyAccepted,
        ] => (&user2, &user3),
        [
            escrow_canister::notify_deposit::Response::SwapAlreadyAccepted,
            escrow_canister::notify_deposit::Response::Success(_),
        ] => (&user3, &user2),
        responses => panic!("Expected one acceptance and one refusal: {responses:?}"),
    };

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, winner.user_id),
        icp_amount
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, loser.user_id),
        chat_amount
    );
}

fn create_icp_for_chat_swap(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    offerer: &User,
    recipient: &User,
    icp_amount: u128,
    chat_amount: u128,
) -> u32 {
    client::escrow::happy_path::create_swap(
        env,
        offerer.user_id.canister_id(),
        canister_ids.escrow,
        P2PSwapLocation::from_message(Chat::Direct(recipient.user_id.into()), None, 0u64.into()),
        icp_token_info(),
        icp_amount,
        None,
        chat_token_info(),
        chat_amount,
        None,
        now_millis(env) + HOUR_IN_MS,
    )
}

fn deposit(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    swap_id: u32,
    user_id: UserId,
    ledger: CanisterId,
    amount: u128,
) {
    let account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user_id.as_principal(), swap_id)),
    };
    client::ledger::happy_path::transfer(env, controller, ledger, account, amount);
}

// Submits the user's notification of their deposit without waiting for it to complete
fn submit_notify_deposit(env: &PocketIc, escrow_canister_id: CanisterId, swap_id: u32, user_id: UserId) -> RawMessageId {
    env.submit_call(
        escrow_canister_id,
        user_id.canister_id(),
        "notify_deposit_msgpack",
        msgpack::serialize_then_unwrap(&escrow_canister::notify_deposit::Args {
            swap_id,
            deposited_by: None,
        }),
    )
    .unwrap()
}

fn await_notify_deposit(env: &PocketIc, message_id: RawMessageId) -> escrow_canister::notify_deposit::Response {
    msgpack::deserialize_then_unwrap(&env.await_call(message_id).unwrap())
}

// Indexed users share a canister, so their wallets are subaccounts of it. Payouts and refunds
// must land in those subaccounts - the raw UserId principal is an account nobody can sign for.
#[test_case(true)]
#[test_case(false)]
fn swap_funds_reach_indexed_users_wallet_subaccounts(complete: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let sender = Principal::from_slice(&[1]);
    let offerer = UserId::new_indexed(canister_ids.user_index, 5);
    let accepter = UserId::new_indexed(canister_ids.user_index, 6);

    let now = now_millis(env);

    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;

    let swap_id = client::escrow::happy_path::create_swap(
        env,
        sender,
        canister_ids.escrow,
        P2PSwapLocation::External,
        icp_token_info(),
        icp_amount,
        Some(offerer.as_principal()),
        chat_token_info(),
        chat_amount,
        Some(accepter.as_principal()),
        now + DAY_IN_MS,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Account {
            owner: canister_ids.escrow,
            subaccount: Some(deposit_subaccount(offerer.as_principal(), swap_id)),
        },
        icp_amount + 10_000,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Account {
            owner: canister_ids.escrow,
            subaccount: Some(deposit_subaccount(accepter.as_principal(), swap_id)),
        },
        chat_amount + 100_000,
    );

    client::escrow::happy_path::notify_deposit(env, sender, canister_ids.escrow, swap_id, Some(offerer.as_principal()));

    if complete {
        let result = client::escrow::happy_path::notify_deposit(
            env,
            sender,
            canister_ids.escrow,
            swap_id,
            Some(accepter.as_principal()),
        );
        assert!(result.complete);

        tick_many(env, 10);

        assert_eq!(
            client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, offerer),
            chat_amount
        );
        assert_eq!(
            client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, accepter),
            icp_amount
        );
    } else {
        client::escrow::happy_path::cancel_swap(env, sender, canister_ids.escrow, swap_id);

        let notify_response = client::escrow::notify_deposit(
            env,
            sender,
            canister_ids.escrow,
            &escrow_canister::notify_deposit::Args {
                swap_id,
                deposited_by: Some(accepter.as_principal()),
            },
        );
        assert!(matches!(
            notify_response,
            escrow_canister::notify_deposit::Response::SwapCancelled
        ));

        tick_many(env, 10);

        assert_eq!(
            client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, offerer),
            icp_amount
        );
        assert_eq!(
            client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, accepter),
            chat_amount
        );
    }

    // The raw principals must hold nothing - funds there would be unrecoverable.
    for (ledger, user_id) in [(canister_ids.icp_ledger, offerer), (canister_ids.chat_ledger, accepter)] {
        assert_eq!(
            client::ledger::happy_path::balance_of(
                env,
                ledger,
                Account {
                    owner: user_id.as_principal(),
                    subaccount: None,
                },
            ),
            0
        );
    }
}
