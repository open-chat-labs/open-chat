use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, TestEnv};
use candid::Principal;
use ic_ledger_types::Tokens;
use icrc_ledger_types::icrc1::account::Account;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{icrc1, CryptoTransaction, Cryptocurrency, MessageContentInitial, PendingCryptoTransaction, PrizeContentInitial};
use utils::time::{HOUR_IN_MS, MINUTE_IN_MS};

#[test]
fn prize_messages_can_be_claimed_successfully() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);
    client::local_user_index::happy_path::join_group(env, user3.principal, canister_ids.local_user_index, group_id);

    // Send user1 some ICP
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1.user_id.into(),
        1_000_000_000u64,
    );

    let prizes = [100000, 200000];
    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_message_id();

    client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes: prizes.iter().copied().map(Tokens::from_e8s).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token,
                    amount: prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128,
                    to: Account::from(Principal::from(group_id)),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            correlation_id: 0,
            rules_accepted: None,
        },
    );

    client::group::happy_path::claim_prize(env, user2.principal, group_id, message_id);
    let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
    assert_eq!(user2_balance, 200000);

    client::group::happy_path::claim_prize(env, user3.principal, group_id, message_id);
    let user3_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user3.user_id.into());
    assert_eq!(user3_balance, 100000);
}

#[test_case(false)]
#[test_case(true)]
fn unclaimed_prizes_get_refunded(delete_message: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    // Send user1 some ICP
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1.user_id.into(),
        1_000_000_000u64,
    );

    let prizes = [100000, 200000];
    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_message_id();

    client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes: prizes.iter().copied().map(Tokens::from_e8s).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token,
                    amount: prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128,
                    to: Account::from(Principal::from(group_id)),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            correlation_id: 0,
            rules_accepted: None,
        },
    );

    client::group::happy_path::claim_prize(env, user2.principal, group_id, message_id);

    let interval = if delete_message {
        client::group::happy_path::delete_messages(env, user1.principal, group_id, None, vec![message_id]);
        5 * MINUTE_IN_MS
    } else {
        HOUR_IN_MS
    };

    env.advance_time(Duration::from_millis(interval - 1));
    env.tick();

    let user1_balance_before_refund = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id.into());

    env.advance_time(Duration::from_millis(1));
    tick_many(env, 2);

    let user1_balance_after_refund = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id.into());

    assert_eq!(user1_balance_after_refund, user1_balance_before_refund + 100000);
}
