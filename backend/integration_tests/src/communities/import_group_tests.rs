use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_ledger_types::Tokens;
use icrc_ledger_types::icrc1::account::Account;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::{
    icrc1, ChatId, CommunityId, CryptoTransaction, Cryptocurrency, MessageContentInitial, PendingCryptoTransaction,
    PrizeContentInitial,
};
use user_canister::mark_read::ChatMessagesRead;
use utils::time::HOUR_IN_MS;

#[test]
fn import_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        group_id,
        group_name,
        community_id,
        default_channels,
    } = init_test_data(env, canister_ids, *controller);

    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);

        client::group::happy_path::send_text_message(env, &user1, group_id, None, text, None);
    }

    let import_group_response = client::community::import_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::import_group::Args { group_id },
    );

    assert!(matches!(
        import_group_response,
        community_canister::import_group::Response::Success(_)
    ));

    tick_many(env, 10);

    let expected_channel_names: Vec<_> = default_channels.into_iter().chain([group_name]).sorted().collect();

    let community_summary1 = client::community::happy_path::summary(env, &user1, community_id);
    assert_eq!(
        community_summary1.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        expected_channel_names
    );

    let community_summary2 = client::community::happy_path::summary(env, &user2, community_id);
    assert_eq!(
        community_summary2.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        expected_channel_names
    );

    let community_summary3 = client::community::happy_path::summary(env, &user3, community_id);
    assert_eq!(
        community_summary3.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        expected_channel_names
    );

    let initial_state1 = client::user::happy_path::initial_state(env, &user1);
    assert!(initial_state1.group_chats.summaries.is_empty());
    assert_eq!(initial_state1.communities.summaries.len(), 1);

    let initial_state2 = client::user::happy_path::initial_state(env, &user2);
    assert!(initial_state2.group_chats.summaries.is_empty());
    assert_eq!(initial_state2.communities.summaries.len(), 1);

    // Check that the group has been deleted
    assert!(!env.canister_exists(group_id.into()));
}

#[test]
fn read_up_to_data_maintained_after_import() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        group_id,
        community_id,
        ..
    } = init_test_data(env, canister_ids, *controller);

    for _ in 1..5 {
        client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);
    }

    client::user::mark_read(
        env,
        user2.principal,
        user2.user_id.into(),
        &user_canister::mark_read::Args {
            messages_read: vec![ChatMessagesRead {
                chat_id: group_id,
                read_up_to: Some(4.into()),
                threads: Vec::new(),
                date_read_pinned: None,
            }],
            community_messages_read: Vec::new(),
        },
    );

    let import_group_response = client::community::import_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::import_group::Args { group_id },
    );

    let channel_id = match import_group_response {
        community_canister::import_group::Response::Success(result) => result.channel_id,
        response => panic!("{response:?}"),
    };

    tick_many(env, 10);

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    let community = initial_state
        .communities
        .summaries
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();

    let channel = community.channels.iter().find(|c| c.channel_id == channel_id).unwrap();
    assert_eq!(channel.read_by_me_up_to, Some(4.into()));
}

#[test]
fn pending_prizes_transferred_to_community() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        group_id,
        community_id,
        ..
    } = init_test_data(env, canister_ids, *controller);

    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_message_id();
    let prizes = [100000; 2];
    let amount_to_transfer = prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128;

    client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes: prizes.into_iter().map(Tokens::from_e8s).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token: token.clone(),
                    amount: amount_to_transfer,
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
            message_filter_failed: None,
        },
    );

    let import_group_response = client::community::import_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::import_group::Args { group_id },
    );

    let channel_id = match import_group_response {
        community_canister::import_group::Response::Success(result) => result.channel_id,
        response => panic!("{response:?}"),
    };

    tick_many(env, 10);

    let community_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
    assert_eq!(community_balance, amount_to_transfer - token.fee().unwrap());

    client::community::happy_path::claim_prize(env, user2.principal, community_id, channel_id, message_id);
    client::community::happy_path::claim_prize(env, user3.principal, community_id, channel_id, message_id);

    let community_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
    assert_eq!(community_balance, 0);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_name = random_string();
    let community_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let default_channels: Vec<_> = (1..5).map(|_| random_string()).collect();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, true, default_channels.clone());
    client::local_user_index::happy_path::join_community(env, user3.principal, canister_ids.local_user_index, community_id);

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        user3,
        group_id,
        group_name,
        community_id,
        default_channels,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
    group_name: String,
    community_id: CommunityId,
    default_channels: Vec<String>,
}
