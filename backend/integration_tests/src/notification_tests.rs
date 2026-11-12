use crate::call_push_tests::Feed;
use crate::client::INIT_CYCLES_BALANCE;
use crate::env::ENV;
use crate::utils::{metrics, now_millis, now_nanos, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{DAY_IN_MS, ICP_SYMBOL, NANOS_PER_MILLISECOND};
use itertools::Itertools;
use ledger_utils::create_pending_transaction;
use pocket_ic::{PocketIc, Time};
use rand::{Rng, rng};
use std::collections::VecDeque;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    CryptoContent, CryptoTransaction, Empty, FcmToken, MessageContentInitial, NotificationSubscription, TextContent, UnitResult,
};

#[test]
fn direct_message_notification_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let local_user_index_canister = canister_ids.local_user_index(env, user2.canister());
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    // Long enough for the message to reach user2's canister and the notification to reach their
    // LocalUserIndex, even if the users are on different subnets
    tick_many(env, 10);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    assert_eq!(notifications_response.notifications.len(), 1);
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
}

#[test]
fn group_message_notification_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    let local_user_index_canister = canister_ids.local_user_index(env, group_id);

    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        local_user_index_canister,
        group_id,
        vec![(user2.user_id, user2.principal)],
    );

    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    tick_many(env, 3);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    assert_eq!(notifications_response.notifications.len(), 1);
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
}

// A group or channel message's push carries the sender's own avatar id as `senderAvatarId`, never
// the group's, whether or not the message holds a transfer, which takes a separate path through
// the group or community
#[test_case(false, false; "group message")]
#[test_case(false, true; "group message with a transfer")]
#[test_case(true, false; "channel message")]
#[test_case(true, true; "channel message with a transfer")]
fn a_group_or_channel_message_push_carries_the_senders_own_avatar(channel: bool, with_transfer: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user2: recipient, .. } = init_test_data(env, canister_ids);
    let sender = client::register_diamond_user(env, canister_ids, *controller);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, sender.principal, 1_000_000_000);
    let sender_avatar_id = 123_456_789u128;

    let content = if with_transfer {
        MessageContentInitial::Crypto(CryptoContent {
            recipient: recipient.user_id,
            transfer: CryptoTransaction::Pending(create_pending_transaction(
                ICP_SYMBOL.to_string(),
                canister_ids.icp_ledger,
                10_000,
                10_000,
                types::icrc1::Account::legacy_for_user(recipient.user_id),
                None,
                now_nanos(env),
            )),
            caption: None,
        })
    } else {
        MessageContentInitial::Text(TextContent { text: random_string() })
    };

    let feed = Feed::new(canister_ids);
    let snapshot = if channel {
        let community_id =
            client::user::happy_path::create_community(env, &sender, &random_string(), true, vec!["general".to_string()]);
        client::community::happy_path::join_community(env, recipient.principal, community_id);
        env.tick();
        let channel_id = client::community::happy_path::summary(env, recipient.principal, community_id)
            .channels
            .iter()
            .find(|c| c.name == "general")
            .unwrap()
            .channel_id;
        // joining a public channel mutes it by default, and a muted chat never pushes
        let response = client::community::toggle_mute_notifications(
            env,
            recipient.principal,
            community_id.into(),
            &community_canister::toggle_mute_notifications::Args {
                channel_id: Some(channel_id),
                mute: Some(false),
                mute_at_everyone: None,
            },
        );
        assert!(matches!(response, UnitResult::Success));
        tick_many(env, 3);

        let snapshot = feed.snapshot(env, *controller);
        let args = community_canister::send_message::Args {
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content,
            sender_name: sender.username(),
            sender_display_name: None,
            sender_avatar_id: Some(sender_avatar_id),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        };
        let response = if with_transfer {
            client::community::send_message_with_transfer(env, &sender, community_id, args)
        } else {
            client::community::send_message(env, sender.principal, community_id.into(), &args)
        };
        assert!(
            matches!(response, community_canister::send_message::Response::Success(_)),
            "{response:?}"
        );
        snapshot
    } else {
        let group_id = client::user::happy_path::create_group(env, &sender, &random_string(), false, false);
        client::local_user_index::happy_path::add_users_to_group(
            env,
            &sender,
            canister_ids.local_user_index(env, group_id),
            group_id,
            vec![(recipient.user_id, recipient.principal)],
        );

        let snapshot = feed.snapshot(env, *controller);
        let args = group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content,
            sender_name: sender.username(),
            sender_display_name: None,
            sender_avatar_id: Some(sender_avatar_id),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        };
        let response = if with_transfer {
            client::group::send_message_with_transfer(env, &sender, group_id, args)
        } else {
            client::group::send_message_v2(env, sender.principal, group_id.into(), &args)
        };
        assert!(
            matches!(response, group_canister::send_message_v2::Response::Success(_)),
            "{response:?}"
        );
        snapshot
    };

    let pushes = feed.wait_for_pushes(env, *controller, &snapshot, |pushes| {
        pushes.iter().any(|p| p.recipients.contains(&recipient.user_id))
    });
    let push = pushes
        .iter()
        .find(|p| p.recipients.contains(&recipient.user_id))
        .expect("no push for the recipient");
    assert_eq!(
        push.data.get("senderAvatarId"),
        Some(&sender_avatar_id.to_string()),
        "{:?}",
        push.data
    );
}

#[test]
fn direct_message_notification_muted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    // Long enough for the message to reach user2's canister, so that the chat exists there to be
    // muted, and for its notification to reach their LocalUserIndex, even if the users are on
    // different subnets
    tick_many(env, 10);

    client::user::mute_notifications(
        env,
        user2.principal,
        user2.user_id.canister_id(),
        &multi_user_canister::mute_notifications::Args {
            chat_id: user1.user_id.into(),
        },
    );

    let local_user_index_canister = canister_ids.local_user_index(env, user2.canister());
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    // Long enough for a notification to have arrived were the chat not muted
    tick_many(env, 10);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    assert!(notifications_response.notifications.is_empty());
}

#[test_case(1)]
#[test_case(2)]
#[test_case(3)]
fn group_message_notification_muted(case: u32) {
    // case 1: default
    // case 2: @user
    // case 3: @everyone

    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    let local_user_index_canister = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        local_user_index_canister,
        group_id,
        vec![(user2.user_id, user2.principal)],
    );

    client::group::toggle_mute_notifications(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::toggle_mute_notifications::Args {
            mute: Some(true),
            mute_at_everyone: None,
        },
    );

    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    let (text, mentioned) = match case {
        1 => (random_string(), Vec::new()),
        2 => (
            format!("@UserId({})", user2.user_id),
            vec![types::User {
                user_id: user2.user_id,
                username: user2.username(),
            }],
        ),
        3 => ("@everyone".to_string(), Vec::new()),
        _ => panic!(),
    };

    client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent { text }),
            sender_name: user1.username(),
            sender_display_name: None,
            sender_avatar_id: None,
            replies_to: None,
            mentioned,
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    if case == 1 {
        assert!(notifications_response.notifications.is_empty());
    } else {
        assert_eq!(notifications_response.notifications.len(), 1);
    }
}

#[test]
fn only_store_up_to_10_subscriptions_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    for i in 0..20 {
        client::notifications_index::happy_path::push_subscription(
            env,
            user2.principal,
            canister_ids.notifications_index,
            i.to_string(),
            i.to_string(),
            i.to_string(),
        );
    }

    env.tick();

    let local_user_index_canister = canister_ids.local_user_index(env, user2.canister());
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    // Long enough for the message to reach user2's canister and the notification to reach their
    // LocalUserIndex, even if the users are on different subnets
    tick_many(env, 10);

    let mut notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    let subscriptions = notifications_response.subscriptions.remove(&user2.user_id).unwrap();

    assert_eq!(
        subscriptions
            .into_iter()
            .filter_map(|s| match s {
                NotificationSubscription::WebPush(si) => Some(si.endpoint),
                _ => None,
            })
            .collect_vec(),
        (10..20).map(|i| i.to_string()).collect_vec()
    );
}

#[test]
fn subscriptions_removed_based_on_last_active() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData { user1, .. } = init_test_data(env, canister_ids);

    for i in 0..10 {
        client::notifications_index::happy_path::push_subscription(
            env,
            user1.principal,
            canister_ids.notifications_index,
            i.to_string(),
            i.to_string(),
            i.to_string(),
        );
        env.advance_time(Duration::from_secs(1));
    }

    let mut random_ordering: VecDeque<_> = (0..10).sorted_by_cached_key(|_| rng().next_u64()).collect();

    for i in random_ordering.iter() {
        client::notifications_index::happy_path::mark_subscription_active(
            env,
            user1.principal,
            canister_ids.notifications_index,
            i.to_string(),
        );
        env.advance_time(Duration::from_secs(1));
    }

    for i in 10..20 {
        client::notifications_index::happy_path::push_subscription(
            env,
            user1.principal,
            canister_ids.notifications_index,
            i.to_string(),
            i.to_string(),
            i.to_string(),
        );
        env.advance_time(Duration::from_secs(1));

        let removed = random_ordering.pop_front().unwrap();
        assert!(!client::notifications_index::happy_path::subscription_exists(
            env,
            user1.principal,
            canister_ids.notifications_index,
            removed.to_string()
        ));

        if let Some(next) = random_ordering.iter().next() {
            assert!(client::notifications_index::happy_path::subscription_exists(
                env,
                user1.principal,
                canister_ids.notifications_index,
                next.to_string()
            ));
        }
    }
}

#[test]
fn inactive_subscriptions_removed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData { user1, .. } = init_test_data(env, canister_ids);

    // We only remove inactive subscriptions after the timestamp below
    if now_millis(env) < 1767484800000 {
        env.set_time(Time::from_nanos_since_unix_epoch(1767484800000 * NANOS_PER_MILLISECOND));
    }

    let rand1 = random_string();
    let rand2 = random_string();

    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        rand1.clone(),
        rand1.clone(),
        rand1.clone(),
    );

    env.advance_time(Duration::from_millis(DAY_IN_MS));

    client::notifications_index::happy_path::push_subscription(
        env,
        user1.principal,
        canister_ids.notifications_index,
        rand2.clone(),
        rand2.clone(),
        rand2.clone(),
    );

    let subscriptions_total = |env: &PocketIc| {
        metrics(env, canister_ids.notifications_index)["subscriptions"]
            .as_u64()
            .unwrap()
    };
    let total_before = subscriptions_total(env);

    env.advance_time(Duration::from_millis(89 * DAY_IN_MS + 1));
    env.tick();
    env.tick();

    assert!(subscriptions_total(env) < total_before);

    assert!(!client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        rand1
    ));
    assert!(client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        rand2.clone()
    ));

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    env.tick();
    env.tick();

    assert!(!client::notifications_index::happy_path::subscription_exists(
        env,
        user1.principal,
        canister_ids.notifications_index,
        rand2
    ));
}

#[test]
fn notifications_blocked_from_blocked_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    let local_user_index_canister = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        local_user_index_canister,
        group_id,
        vec![(user2.user_id, user2.principal)],
    );

    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    assert_eq!(notifications_response.notifications.len(), 1);
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));

    client::user::happy_path::block_user(env, &user2, user1.user_id);

    tick_many(env, 10);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    tick_many(env, 3);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 2,
    );

    assert!(notifications_response.notifications.is_empty());

    client::user::happy_path::unblock_user(env, &user2, user1.user_id);

    tick_many(env, 10);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    tick_many(env, 3);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 2,
    );

    assert_eq!(notifications_response.notifications.len(), 1);
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
}

#[test]
fn new_local_user_index_receives_existing_fcm_tokens() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let response = client::notifications_index::add_fcm_token(
        env,
        user.principal,
        canister_ids.notifications_index,
        &notifications_index_canister::add_fcm_token::Args {
            fcm_token: FcmToken(random_string()),
        },
    );
    assert!(matches!(response, UnitResult::Success));

    // Long enough for the token to reach every existing LocalUserIndex
    tick_many(env, 10);

    // Expand onto a subnet the Registry hasn't expanded onto yet. In test mode the Registry takes
    // a LocalUserIndex created up front, then installs it and tells the other canisters of it
    let subnet_id = env.topology().get_sns().unwrap();
    let local_user_index = env.create_canister_on_subnet(Some(canister_ids.registry), None, subnet_id);
    env.add_cycles(local_user_index, INIT_CYCLES_BALANCE);
    client::registry::happy_path::expand_onto_subnet(
        env,
        *controller,
        canister_ids.registry,
        subnet_id,
        Some(local_user_index),
    );

    let fcm_token_count = |env: &PocketIc, canister_id| metrics(env, canister_id)["fcm_token_count"].as_u64().unwrap();
    let expected = fcm_token_count(env, canister_ids.local_user_index(env, user.canister()));
    assert!(expected > 0);

    for _ in 0..30 {
        if fcm_token_count(env, local_user_index) == expected {
            break;
        }
        env.tick();
    }
    assert_eq!(fcm_token_count(env, local_user_index), expected);

    // The env now has a LocalUserIndex on a subnet its `canister_ids` don't know of
    wrapper.discard();
}

#[test]
fn notification_canisters_returns_correct_ids() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let notification_canisters = client::notifications_index::notification_canisters(
        env,
        Principal::anonymous(),
        canister_ids.notifications_index,
        &Empty {},
    );

    assert_eq!(
        notification_canisters.into_iter().sorted().collect_vec(),
        canister_ids.subnets.iter().map(|s| s.local_user_index).sorted().collect_vec()
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds) -> TestData {
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::notifications_index::happy_path::push_subscription(
        env,
        user2.principal,
        canister_ids.notifications_index,
        "123",
        "456",
        "https://xyz.com/",
    );

    // Long enough for the subscription to reach every LocalUserIndex, including those on a
    // different subnet from the NotificationsIndex
    tick_many(env, 10);

    TestData { user1, user2 }
}

struct TestData {
    user1: User,
    user2: User,
}
