use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use constants::DAY_IN_MS;
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use std::ops::Deref;
use types::{Chat, Cryptocurrency, P2PSwapLocation};

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
        user1.user_id.into(),
        canister_ids.escrow,
        P2PSwapLocation::from_message(Chat::Direct(user2.user_id.into()), None, 0u64.into()),
        Cryptocurrency::InternetComputer,
        icp_amount,
        Cryptocurrency::CHAT,
        chat_amount,
        now + DAY_IN_MS,
    );

    let user1_deposit_account = Account {
        owner: canister_ids.escrow,
        subaccount: Some(deposit_subaccount(user1.user_id, swap_id)),
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
        subaccount: Some(deposit_subaccount(user2.user_id, swap_id)),
    };

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user2_deposit_account,
        chat_amount + 100_000,
    );

    let result1 = client::escrow::happy_path::notify_deposit(env, user1.user_id, canister_ids.escrow, swap_id);
    let result2 = client::escrow::happy_path::notify_deposit(env, user2.user_id, canister_ids.escrow, swap_id);

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
