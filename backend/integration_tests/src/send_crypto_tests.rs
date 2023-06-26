use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::now_nanos;
use crate::{client, TestEnv};
use ic_ledger_types::Tokens;
use ledger_utils::create_pending_transaction;
use std::ops::Deref;
use types::nns::UserOrAccount;
use types::{nns, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContentInitial, PendingCryptoTransaction};

#[test]
fn send_direct_message_with_transfer_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    // Send user1 some ICP
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1.user_id.into(),
        1_000_000_000u64,
    );

    let send_message_result = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    Tokens::from_e8s(10000),
                    user2.user_id,
                    now_nanos(env),
                )),
                caption: None,
            }),
            sender_name: user1.username(),
            replies_to: None,
            forwarding: false,
            correlation_id: 0,
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ) {
        let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
        assert_eq!(user2_balance, 10000);
    } else {
        panic!("{send_message_result:?}")
    }
}

#[test]
fn send_message_with_transfer_to_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    // Send user1 some ICP
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user1.user_id.into(),
        1_000_000_000u64,
    );

    let send_message_result = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    Tokens::from_e8s(10000),
                    user2.user_id,
                    now_nanos(env),
                )),
                caption: None,
            }),
            sender_name: user1.username(),
            replies_to: None,
            mentioned: Vec::new(),
            correlation_id: 0,
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ) {
        let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
        assert_eq!(user2_balance, 10000);
    } else {
        panic!("{send_message_result:?}")
    }
}
