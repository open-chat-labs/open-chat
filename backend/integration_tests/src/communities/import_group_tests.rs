use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use constants::HOUR_IN_MS;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::{random_from_u128, random_string};
use types::{
    icrc1, Chat, ChatEvent, ChatId, CommunityId, CryptoTransaction, Cryptocurrency, EventIndex, MessageContentInitial,
    PendingCryptoTransaction, PrizeContentInitial, ReplyContext, TextContent,
};
use user_canister::mark_read::ChatMessagesRead;

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
        user4,
        group_id,
        group_name,
        community_id,
        default_channels,
    } = init_test_data(env, canister_ids, *controller);

    client::group::happy_path::block_user(env, user1.principal, group_id, user4.user_id);

    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);

        client::group::happy_path::send_text_message(env, &user1, group_id, None, text, None);
    }

    let import_group_response = client::community::happy_path::import_group(env, user1.principal, community_id, group_id);

    tick_many(env, 20);

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

    let selected_initial = client::community::happy_path::selected_initial(env, &user1, community_id);
    assert_eq!(selected_initial.blocked_users.len(), 1);

    let selected_channel_initial =
        client::community::happy_path::selected_channel_initial(env, &user1, community_id, import_group_response.channel_id);
    assert!(selected_channel_initial.blocked_users.is_empty());

    let events = client::community::happy_path::events(
        env,
        &user1,
        community_id,
        import_group_response.channel_id,
        EventIndex::default(),
        true,
        100,
        100,
    );
    assert!(events.events.len() > 10);

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
    let message_id = random_from_u128();
    let prizes = vec![100000; 2];
    let amount_to_transfer = prizes.iter().sum::<u128>() + fee * prizes.len() as u128;

    client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token: token.clone(),
                    amount: amount_to_transfer,
                    to: group_id.into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
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

    let community_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
    assert_eq!(community_balance, amount_to_transfer - token.fee().unwrap());

    client::community::happy_path::claim_prize(env, user2.principal, community_id, channel_id, message_id);
    client::community::happy_path::claim_prize(env, user3.principal, community_id, channel_id, message_id);

    let community_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
    assert_eq!(community_balance, 0);
}

#[test]
fn private_replies_to_group_updated_to_community() {
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

    let send_message_response =
        client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    client::user::send_message_v2(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user1.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent { text: random_string() }),
            replies_to: Some(ReplyContext {
                chat_if_other: Some((Chat::Group(group_id), None)),
                event_index: send_message_response.event_index,
            }),
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
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

    let user1_event = client::user::happy_path::events(env, &user1, user2.user_id, EventIndex::default(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(m) = user1_event {
        if let Some(replies_to) = m.replies_to {
            assert_eq!(
                replies_to.chat_if_other,
                Some((Chat::Channel(community_id, channel_id), None))
            );
            assert_eq!(replies_to.event_index, send_message_response.event_index);
        } else {
            panic!();
        }
    } else {
        panic!();
    }

    let user2_event = client::user::happy_path::events(env, &user2, user1.user_id, EventIndex::default(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(m) = user2_event {
        if let Some(replies_to) = m.replies_to {
            assert_eq!(
                replies_to.chat_if_other,
                Some((Chat::Channel(community_id, channel_id), None))
            );
            assert_eq!(replies_to.event_index, send_message_response.event_index);
        } else {
            panic!();
        }
    } else {
        panic!();
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);
    let user4 = client::register_user(env, canister_ids);

    let group_name = random_string();
    let community_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let default_channels: Vec<_> = (1..5).map(|_| random_string()).collect();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, true, default_channels.clone());
    client::local_user_index::happy_path::join_community(
        env,
        user3.principal,
        canister_ids.local_user_index,
        community_id,
        None,
    );

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        user3,
        user4,
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
    user4: User,
    group_id: ChatId,
    group_name: String,
    community_id: CommunityId,
    default_channels: Vec<String>,
}
