use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{SubscriptionInfo, SubscriptionKeys};

#[test]
fn direct_message_notification_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let latest_notification_index = latest_notification_index(env, canister_ids.notifications, *controller);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", None);

    let notifications_canister::notifications::Response::Success(notifications_response) = client::notifications::notifications(
        env,
        *controller,
        canister_ids.notifications,
        &notifications_canister::notifications::Args {
            from_notification_index: latest_notification_index + 1,
        },
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
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let latest_notification_index = latest_notification_index(env, canister_ids.notifications, *controller);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    client::group::happy_path::add_participants(env, &user1, group_id, vec![user2.user_id]);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, "TEXT", None);

    let notifications_canister::notifications::Response::Success(notifications_response) = client::notifications::notifications(
        env,
        *controller,
        canister_ids.notifications,
        &notifications_canister::notifications::Args {
            from_notification_index: latest_notification_index + 1,
        },
    );

    // There should be 2 notifications (1 for being added to the group, 1 for the message)
    assert_eq!(notifications_response.notifications.len(), 2);
    assert!(notifications_response.subscriptions.contains_key(&user2.user_id));
}

#[test]
fn direct_message_notification_muted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT1", None);
    client::user::mute_notifications(
        env,
        user2.principal,
        user2.user_id.into(),
        &user_canister::mute_notifications::Args {
            chat_id: user1.user_id.into(),
        },
    );

    let latest_notification_index = latest_notification_index(env, canister_ids.notifications, *controller);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT2", None);

    let notifications_canister::notifications::Response::Success(notifications_response) = client::notifications::notifications(
        env,
        *controller,
        canister_ids.notifications,
        &notifications_canister::notifications::Args {
            from_notification_index: latest_notification_index + 1,
        },
    );

    assert!(notifications_response.notifications.is_empty());
}

#[test]
fn group_message_notification_muted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    client::group::happy_path::add_participants(env, &user1, group_id, vec![user2.user_id]);

    client::user::mute_notifications(
        env,
        user2.principal,
        user2.user_id.into(),
        &user_canister::mute_notifications::Args { chat_id: group_id },
    );

    let latest_notification_index = latest_notification_index(env, canister_ids.notifications, *controller);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, "TEXT", None);

    let notifications_canister::notifications::Response::Success(notifications_response) = client::notifications::notifications(
        env,
        *controller,
        canister_ids.notifications,
        &notifications_canister::notifications::Args {
            from_notification_index: latest_notification_index + 1,
        },
    );

    assert!(notifications_response.notifications.is_empty());
}

fn latest_notification_index(env: &StateMachine, notifications_canister_id: Principal, controller: Principal) -> u64 {
    let notifications_canister::latest_notification_index::Response::Success(latest_notification_index) =
        client::notifications::latest_notification_index(
            env,
            controller,
            notifications_canister_id,
            &notifications_canister::latest_notification_index::Args {},
        );

    latest_notification_index
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds) -> TestData {
    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::notifications_index::push_subscription(
        env,
        user2.principal,
        canister_ids.notifications_index,
        &notifications_index_canister::push_subscription::Args {
            subscription: SubscriptionInfo {
                keys: SubscriptionKeys {
                    auth: "123".to_string(),
                    p256dh: "456".to_string(),
                },
                endpoint: "https://xyz.com/".to_string(),
            },
        },
    );

    TestData { user1, user2 }
}

struct TestData {
    user1: User,
    user2: User,
}
