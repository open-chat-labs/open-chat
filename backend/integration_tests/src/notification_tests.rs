use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{Empty, MessageContentInitial, NotificationSubscription, TextContent};

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
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        local_user_index_canister,
        group_id,
        vec![(user2.user_id, user2.principal)],
    );

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    assert_eq!(notifications_response.notifications.len(), 1, "{notifications_response:?}");
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    tick_many(env, 3);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 1,
    );

    // There should be 2 notifications (1 for being added to the group, 1 for the message)
    assert_eq!(notifications_response.notifications.len(), 2, "{notifications_response:?}");
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
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
    client::user::mute_notifications(
        env,
        user2.principal,
        user2.user_id.into(),
        &user_canister::mute_notifications::Args {
            chat_id: user1.user_id.into(),
        },
    );

    let local_user_index_canister = canister_ids.local_user_index(env, user2.canister());
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

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
        &group_canister::toggle_mute_notifications::Args { mute: true },
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
            replies_to: None,
            mentioned,
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
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
            "https://xyz.com/",
        );
    }

    env.tick();

    let local_user_index_canister = canister_ids.local_user_index(env, user2.canister());
    let latest_notification_index =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index_canister);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    tick_many(env, 3);

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
                NotificationSubscription::WebPush(si) => Some(si.keys.p256dh),
                _ => None,
            })
            .collect_vec(),
        (10..20).map(|i| i.to_string()).collect_vec()
    );
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

    tick_many(env, 5);

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

    tick_many(env, 5);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);

    let notifications_response = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index_canister,
        latest_notification_index + 2,
    );

    assert_eq!(
        notifications_response.notifications.len(),
        1,
        "{:?}",
        notifications_response.notifications
    );
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
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

    tick_many(env, 3);

    TestData { user1, user2 }
}

struct TestData {
    user1: User,
    user2: User,
}
