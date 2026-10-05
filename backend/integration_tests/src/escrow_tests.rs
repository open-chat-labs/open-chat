use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::utils::{chat_token_info, icp_token_info, now_millis, tick_many, try_metrics};
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
use types::{CanisterId, Chat, HttpRequest, P2PSwapLocation, TokenInfo, UserId};

const TEST_TOKEN_FEE: u128 = 10_000;

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

// Notifying a deposit again once it is recorded, as a retry may, or anyone naming the depositor may,
// leaves it in place for the swap's payouts rather than refunding it, on either side of the swap
#[test]
fn a_recorded_deposit_is_not_refunded_when_notified_again() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;
    let notify_naming = |env: &mut PocketIc, sender: &User, swap_id: u32, depositor: &User| {
        let response = client::escrow::notify_deposit(
            env,
            sender.user_id.canister_id(),
            canister_ids.escrow,
            &escrow_canister::notify_deposit::Args {
                swap_id,
                deposited_by: Some(depositor.user_id.as_principal()),
            },
        );
        assert!(
            matches!(response, escrow_canister::notify_deposit::Response::Success(_)),
            "{response:?}"
        );
    };
    let balance_of =
        |env: &PocketIc, ledger: CanisterId, user: &User| client::ledger::happy_path::balance_of(env, ledger, user.user_id);

    // The offerer's deposit, notified again by someone else, stays in the swap
    let swap_id = create_icp_for_chat_swap(env, canister_ids, &user1, &user2, icp_amount, chat_amount);
    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user1.user_id,
        canister_ids.icp_ledger,
        icp_amount + 10_000,
    );
    notify_naming(env, &user1, swap_id, &user1);
    notify_naming(env, &user2, swap_id, &user1);
    tick_many(env, 10);
    assert_eq!(balance_of(env, canister_ids.icp_ledger, &user1), 0);

    // And so the acceptor is paid in full once they complete the swap
    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user2.user_id,
        canister_ids.chat_ledger,
        chat_amount + 100_000,
    );
    notify_naming(env, &user2, swap_id, &user2);
    tick_many(env, 10);
    assert_eq!(balance_of(env, canister_ids.chat_ledger, &user1), chat_amount);
    assert_eq!(balance_of(env, canister_ids.icp_ledger, &user2), icp_amount);

    // Likewise the acceptor's deposit, recorded before the offerer's, stays in the swap when notified
    // again
    let swap_id = create_icp_for_chat_swap(env, canister_ids, &user1, &user2, icp_amount, chat_amount);
    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user2.user_id,
        canister_ids.chat_ledger,
        chat_amount + 100_000,
    );
    notify_naming(env, &user2, swap_id, &user2);
    notify_naming(env, &user1, swap_id, &user2);
    tick_many(env, 10);
    assert_eq!(balance_of(env, canister_ids.chat_ledger, &user2), 0);

    deposit(
        env,
        canister_ids,
        *controller,
        swap_id,
        user1.user_id,
        canister_ids.icp_ledger,
        icp_amount + 10_000,
    );
    notify_naming(env, &user1, swap_id, &user1);
    tick_many(env, 10);
    assert_eq!(balance_of(env, canister_ids.chat_ledger, &user1), 2 * chat_amount);
    assert_eq!(balance_of(env, canister_ids.icp_ledger, &user2), 2 * icp_amount);
}

// A deposit is checked against the ledger before it is recorded, so the swap can end while the
// check is in flight. The deposit must then be refunded rather than recorded against a swap which
// has nothing left to refund it. The swap is ended by expiry, since the test can move the clock
// while the check waits; a `cancel_swap` sent from the test was found to be handled only once the
// check had finished, but a cancellation landing in between takes the same path.
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

// The escrow canister notifies the canister a swap names of each change to its status. A failed
// notification is retried once the delay the failure calls for has passed, rather than round after
// round, until it succeeds or 10 attempts have failed. A call to a stopped canister is retried after
// 10 seconds.
#[test]
fn status_change_notification_to_stopped_canister_is_retried_after_a_delay() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // Each swap notifies a stopped canister, one of which is started again part way through
    client::stop_canister(env, user1.local_user_index, user1.canister());
    client::stop_canister(env, user2.local_user_index, user2.canister());
    let restarted_swap_id = complete_swap_notifying(env, canister_ids, *controller, &user1, &user2, user2.canister());
    let stopped_swap_id = complete_swap_notifying(env, canister_ids, *controller, &user1, &user2, user1.canister());
    let failures = |env: &PocketIc| {
        (
            notification_failures(env, canister_ids.escrow, restarted_swap_id),
            notification_failures(env, canister_ids.escrow, stopped_swap_id),
        )
    };

    // Time doesn't pass as the rounds do, so however many there are, the notifications aren't retried
    tick_many(env, 20);
    assert_eq!(failures(env), (1, 1));

    env.advance_time(Duration::from_secs(10));
    tick_many(env, 5);
    assert_eq!(failures(env), (2, 2));

    // Every failure is recorded, so the restarted canister's count staying put shows its next retry
    // succeeded, while the other notification is given up on after 10 failures
    client::start_canister(env, user2.local_user_index, user2.canister());
    for _ in 0..15 {
        env.advance_time(Duration::from_secs(10));
        tick_many(env, 5);
    }
    assert_eq!(failures(env), (2, 10));

    client::start_canister(env, user1.local_user_index, user1.canister());
}

// A canister which has been uninstalled won't be reinstalled, eg. one whose user was deleted or
// migrated to a MultiUser canister, so a notification to it is dropped rather than retried
#[test]
fn status_change_notification_to_uninstalled_canister_is_dropped() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    // A canister with no wasm, as an uninstalled one has
    let canister_to_notify = client::create_canister(env, *controller);

    let swap_id = complete_swap_notifying(env, canister_ids, *controller, &user1, &user2, canister_to_notify);

    tick_many(env, 20);
    // Longer than any retry delay
    env.advance_time(Duration::from_millis(10 * MINUTE_IN_MS));
    tick_many(env, 5);
    assert_eq!(notification_failures(env, canister_ids.escrow, swap_id), 1);
}

// A payment whose ledger can't be called, eg. because the ledger is stopped or traps, is retried
// after a delay which doubles with each failure, up to an hour, rather than round after round, and
// is never given up on. A call to a stopped canister is first retried after 10 seconds. Only the
// first 3 failures are recorded against the swap.
#[test]
fn payment_failing_to_call_into_ledger_is_retried_with_backoff() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let offerer = Principal::from_slice(&[10, 1]);
    let amount = 1_000_000_000;
    let (ledger, swap_id) = create_swap_with_deposit_on_new_ledger(env, canister_ids, *controller, offerer, amount);

    let failures = |env: &PocketIc| ledger_call_failures(env, canister_ids.escrow, swap_id);
    let awaiting_retry = |env: &PocketIc| escrow_metric(env, canister_ids.escrow, "payments_awaiting_retry");
    let awaiting_retry_before = awaiting_retry(env);

    client::stop_canister(env, *controller, ledger);
    client::escrow::happy_path::cancel_swap(env, offerer, canister_ids.escrow, swap_id);

    // Time doesn't pass as the rounds do, so however many there are, the refund isn't retried
    tick_many(env, 20);
    assert_eq!(failures(env), 1);

    // Retried 10 seconds after the 1st failure
    env.advance_time(Duration::from_secs(9));
    tick_many(env, 10);
    assert_eq!(failures(env), 1);
    env.advance_time(Duration::from_secs(2));
    tick_many(env, 10);
    assert_eq!(failures(env), 2);

    // Then 20 seconds after the 2nd
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 10);
    assert_eq!(failures(env), 2);
    env.advance_time(Duration::from_secs(10));
    tick_many(env, 10);
    assert_eq!(failures(env), 3);

    // Then 40 seconds after the 3rd, which fails again but isn't recorded
    env.advance_time(Duration::from_secs(45));
    tick_many(env, 10);
    assert_eq!(failures(env), 3);
    assert_eq!(awaiting_retry(env), awaiting_retry_before + 1);

    // And 80 seconds after the 4th, by when the ledger is back, so the refund is made
    client::start_canister(env, *controller, ledger);
    env.advance_time(Duration::from_secs(90));
    tick_many(env, 10);
    assert_eq!(client::ledger::happy_path::balance_of(env, ledger, offerer), amount);
    assert_eq!(failures(env), 3);
    assert_eq!(awaiting_retry(env), awaiting_retry_before);
}

// A ledger which has been deleted won't come back, and one which has been uninstalled has lost its
// balances, so a payment from either is parked, being kept but not retried
#[test]
fn payment_from_uninstalled_ledger_is_parked() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let offerer = Principal::from_slice(&[10, 2]);
    let (ledger, swap_id) = create_swap_with_deposit_on_new_ledger(env, canister_ids, *controller, offerer, 1_000_000_000);
    let parked_payments = |env: &PocketIc| escrow_metric(env, canister_ids.escrow, "parked_payments");
    let parked_before = parked_payments(env);

    env.uninstall_canister(ledger, Some(*controller)).unwrap();
    client::escrow::happy_path::cancel_swap(env, offerer, canister_ids.escrow, swap_id);

    tick_many(env, 20);
    // Longer than any retry delay
    env.advance_time(Duration::from_millis(HOUR_IN_MS + MINUTE_IN_MS));
    tick_many(env, 10);
    assert_eq!(ledger_call_failures(env, canister_ids.escrow, swap_id), 1);
    assert_eq!(parked_payments(env), parked_before + 1);
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

// Creates a swap of ICP offered by `offerer` for CHAT, which names `canister_to_notify` to be
// notified of its status changes, and has `accepter` accept it, completing it
fn complete_swap_notifying(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    offerer: &User,
    accepter: &User,
    canister_to_notify: CanisterId,
) -> u32 {
    let icp_amount = 100_000_000_000;
    let chat_amount = 1_000_000_000_000;

    let response = client::escrow::create_swap(
        env,
        offerer.user_id.canister_id(),
        canister_ids.escrow,
        &escrow_canister::create_swap::Args {
            location: P2PSwapLocation::from_message(Chat::Direct(accepter.user_id.into()), None, 0u64.into()),
            token0: icp_token_info(),
            token0_amount: icp_amount,
            token0_principal: None,
            token1: chat_token_info(),
            token1_amount: chat_amount,
            token1_principal: None,
            expires_at: now_millis(env) + HOUR_IN_MS,
            additional_admins: Vec::new(),
            canister_to_notify: Some(canister_to_notify),
            is_public: false,
        },
    );
    let escrow_canister::create_swap::Response::Success(result) = response else {
        panic!("'create_swap' error: {response:?}");
    };
    let swap_id = result.id;

    deposit(
        env,
        canister_ids,
        controller,
        swap_id,
        offerer.user_id,
        canister_ids.icp_ledger,
        icp_amount + 10_000,
    );
    client::escrow::happy_path::notify_deposit(env, offerer.user_id.canister_id(), canister_ids.escrow, swap_id, None);
    deposit(
        env,
        canister_ids,
        controller,
        swap_id,
        accepter.user_id,
        canister_ids.chat_ledger,
        chat_amount + 100_000,
    );
    let result =
        client::escrow::happy_path::notify_deposit(env, accepter.user_id.canister_id(), canister_ids.escrow, swap_id, None);
    assert!(result.complete);

    swap_id
}

// The number of failed attempts to notify the swap's `canister_to_notify` of its status, each of
// which the escrow canister records against the swap
fn notification_failures(env: &PocketIc, escrow_canister_id: CanisterId, swap_id: u32) -> usize {
    swap_errors(env, escrow_canister_id, swap_id)
        .iter()
        .filter(|error| error.starts_with("Failed to notify"))
        .count()
}

// Creates a swap offering a token on a ledger of its own, which `offerer` deposits, so that the test
// can stop or uninstall the ledger without affecting any other test. Returns the ledger and swap id.
fn create_swap_with_deposit_on_new_ledger(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    offerer: Principal,
    amount: u128,
) -> (CanisterId, u32) {
    let ledger = install_icrc_ledger(
        env,
        controller,
        "Test".to_string(),
        "TEST".to_string(),
        TEST_TOKEN_FEE as u64,
        None,
        Vec::new(),
    );

    let swap_id = client::escrow::happy_path::create_swap(
        env,
        offerer,
        canister_ids.escrow,
        P2PSwapLocation::External,
        TokenInfo {
            symbol: "TEST".to_string(),
            ledger,
            decimals: 8,
            fee: TEST_TOKEN_FEE,
        },
        amount,
        None,
        chat_token_info(),
        1_000_000_000_000,
        None,
        now_millis(env) + DAY_IN_MS,
    );

    let account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(offerer, swap_id)),
    };
    client::ledger::happy_path::transfer(env, controller, ledger, account, amount + TEST_TOKEN_FEE);
    client::escrow::happy_path::notify_deposit(env, offerer, canister_ids.escrow, swap_id, None);

    (ledger, swap_id)
}

// The number of failed calls into a ledger to make the swap's payments which the escrow canister
// has recorded against the swap
fn ledger_call_failures(env: &PocketIc, escrow_canister_id: CanisterId, swap_id: u32) -> usize {
    swap_errors(env, escrow_canister_id, swap_id)
        .iter()
        .filter(|error| error.starts_with("Failed to call into ledger"))
        .count()
}

fn escrow_metric(env: &PocketIc, escrow_canister_id: CanisterId, name: &str) -> u64 {
    try_metrics(env, escrow_canister_id).unwrap()[name].as_u64().unwrap()
}

// The errors the escrow canister has recorded against the swap
fn swap_errors(env: &PocketIc, escrow_canister_id: CanisterId, swap_id: u32) -> Vec<String> {
    let response = client::http_request(
        env,
        Principal::anonymous(),
        escrow_canister_id,
        &HttpRequest {
            method: "GET".to_string(),
            url: format!("/swap_logs?swap_id={swap_id}"),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    assert_eq!(response.status_code, 200);

    let swap: serde_json::Value = serde_json::from_slice(&response.body).unwrap();
    swap["errors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|error| error.as_str().unwrap().to_string())
        .collect()
}
