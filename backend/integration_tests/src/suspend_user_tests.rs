use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{CanisterId, MessageContentInitial, TextContent, TimestampMillis, UserId};

#[test]
fn suspend_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        platform_moderator,
    } = init_test_data(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, false);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), false, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());

    client::user_index::suspend_user(
        env,
        platform_moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: user1.user_id,
            duration: None,
            reason: "spamming".to_string(),
        },
    );

    env.tick();

    let user_response1 = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert!(user_response1.suspension_details.is_some());

    let direct_message_response1 = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        direct_message_response1,
        user_canister::send_message_v2::Response::UserSuspended
    ));

    let group_message_response1 = client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            sender_name: user1.username(),
            sender_display_name: None,
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            correlation_id: 0,
        },
    );

    if !matches!(
        group_message_response1,
        group_canister::send_message_v2::Response::UserSuspended
    ) {
        panic!("'send_message_v2' error: {group_message_response1:?}");
    }

    let community_message_response1 = client::community::send_message(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::send_message::Args {
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            sender_name: user1.username(),
            sender_display_name: None,
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
        },
    );
    assert!(matches!(
        community_message_response1,
        community_canister::send_message::Response::UserSuspended
    ));

    client::user_index::unsuspend_user(
        env,
        platform_moderator.principal,
        canister_ids.user_index,
        &user_index_canister::unsuspend_user::Args { user_id: user1.user_id },
    );

    env.tick();

    let user_response2 = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert!(user_response2.suspension_details.is_none());

    let direct_message_response2 = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        direct_message_response2,
        user_canister::send_message_v2::Response::Success(_)
    ));

    let group_message_response2 = client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            sender_name: user1.username(),
            sender_display_name: None,
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        group_message_response2,
        group_canister::send_message_v2::Response::Success(_)
    ));

    let community_message_response2 = client::community::send_message(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::send_message::Args {
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            sender_name: user1.username(),
            sender_display_name: None,
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
        },
    );
    assert!(matches!(
        community_message_response2,
        community_canister::send_message::Response::Success(_)
    ));
}

#[test]
fn suspend_user_for_duration() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        platform_moderator,
    } = init_test_data(env, canister_ids, *controller);

    client::user_index::add_platform_moderator(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: platform_moderator.user_id,
        },
    );

    client::user_index::suspend_user(
        env,
        platform_moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: user1.user_id,
            duration: Some(1000),
            reason: "spamming".to_string(),
        },
    );

    env.advance_time(Duration::from_millis(999));
    env.tick();

    let user_response1 = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert!(user_response1.suspension_details.is_some());

    env.advance_time(Duration::from_millis(1));
    env.tick();

    let user_response2 = client::user_index::happy_path::current_user(env, user1.principal, canister_ids.user_index);
    assert!(user_response2.suspension_details.is_none());
}

#[test]
fn suspended_users_returned_from_user_index_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        platform_moderator,
    } = init_test_data(env, canister_ids, *controller);

    env.advance_time(Duration::from_millis(1));
    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));

    client::user_index::suspend_user(
        env,
        platform_moderator.principal,
        canister_ids.user_index,
        &user_index_canister::suspend_user::Args {
            user_id: user1.user_id,
            duration: Some(1000),
            reason: "spamming".to_string(),
        },
    );

    get_and_validate_users_response(start, env, canister_ids.user_index, vec![(user1.user_id, true)]);
    get_and_validate_users_response(start + 1, env, canister_ids.user_index, Vec::new());

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    get_and_validate_users_response(start + 1000, env, canister_ids.user_index, vec![(user1.user_id, false)]);
    get_and_validate_users_response(start + 1001, env, canister_ids.user_index, Vec::new());

    fn get_and_validate_users_response(
        since: TimestampMillis,
        env: &PocketIc,
        user_index_canister_id: CanisterId,
        mut expected: Vec<(UserId, bool)>,
    ) {
        let user_index_canister::users::Response::Success(result) = client::user_index::users(
            env,
            Principal::anonymous(),
            user_index_canister_id,
            &user_index_canister::users::Args {
                user_groups: Vec::new(),
                users_suspended_since: Some(since),
            },
        );

        let actual: Vec<_> = result
            .users
            .into_iter()
            .filter_map(|u| u.stable.map(|stable| (u.user_id, stable.suspended)))
            .sorted()
            .collect();

        expected.sort();

        assert_eq!(actual, expected);
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let platform_moderator = client::register_user(env, canister_ids);

    client::user_index::add_platform_moderator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args {
            user_id: platform_moderator.user_id,
        },
    );

    TestData {
        user1,
        user2,
        platform_moderator,
    }
}

struct TestData {
    user1: User,
    user2: User,
    platform_moderator: User,
}
