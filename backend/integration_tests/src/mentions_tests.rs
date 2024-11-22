use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{ChatId, GroupPermissionRole, MessageContentInitial, OptionalGroupPermissions, TextContent};

#[test_case(false; "By userId")]
#[test_case(true; "By mentioning @everyone")]
fn mention_users_succeeds(mention_everyone: bool) {
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
    } = init_test_data(env, canister_ids, *controller);

    let text = if mention_everyone {
        "Hello @everyone!".to_string()
    } else {
        format!("Hello @UserId({}) and @UserId({})!", user2.user_id, user3.user_id)
    };

    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Text(TextContent { text }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: if mention_everyone { Vec::new() } else { vec![(&user2).into(), (&user3).into()] },
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        send_message_response,
        group_canister::send_message_v2::Response::Success(_)
    ));

    let user2_summary = client::group::happy_path::summary(env, &user2, group_id);
    assert_eq!(user2_summary.mentions.len(), 1);
    let mention = user2_summary.mentions.first().unwrap();
    assert_eq!(mention.message_index, 0.into());
    assert_eq!(mention.message_id, message_id);

    let user3_summary = client::group::happy_path::summary(env, &user3, group_id);
    assert_eq!(user3_summary.mentions.len(), 1);
    let mention = user3_summary.mentions.first().unwrap();
    assert_eq!(mention.message_index, 0.into());
    assert_eq!(mention.message_id, message_id);
}

#[test_case(true; "authorized")]
#[test_case(false; "not authorized")]
fn mention_everyone_only_succeeds_if_authorized(authorized: bool) {
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
        user3: _,
        group_id,
    } = init_test_data(env, canister_ids, *controller);

    if authorized {
        client::group::happy_path::update_group(
            env,
            user1.principal,
            group_id,
            &group_canister::update_group_v2::Args {
                permissions_v2: Some(OptionalGroupPermissions {
                    mention_all_members: Some(GroupPermissionRole::Members),
                    ..Default::default()
                }),
                ..Default::default()
            },
        );
    }

    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_v2(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Text(TextContent {
                text: "Hello @everyone!".to_string(),
            }),
            sender_name: user1.username(),
            sender_display_name: None,
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
        send_message_response,
        group_canister::send_message_v2::Response::Success(_)
    ));

    let user1_summary = client::group::happy_path::summary(env, &user1, group_id);

    if authorized {
        assert_eq!(user1_summary.mentions.len(), 1);
        let mention = user1_summary.mentions.first().unwrap();
        assert_eq!(mention.message_index, 0.into());
        assert_eq!(mention.message_id, message_id);
    } else {
        assert!(user1_summary.mentions.is_empty())
    }
}

#[test]
fn mentioned_in_thread_adds_user_as_follower() {
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
        user3: _,
        group_id,
    } = init_test_data(env, canister_ids, *controller);

    client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None);
    client::group::happy_path::send_text_message(env, &user1, group_id, Some(0.into()), random_string(), None);

    client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: Some(0.into()),
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent {
                text: format!("Hello @UserId({})!", user2.user_id),
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: vec![types::User {
                user_id: user2.user_id,
                username: user2.username(),
            }],
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            correlation_id: 0,
        },
    );

    let summary = client::group::happy_path::summary(env, &user2, group_id);
    assert_eq!(summary.mentions.len(), 1);
    assert_eq!(summary.latest_threads.len(), 1);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);
    client::local_user_index::happy_path::join_group(env, user3.principal, canister_ids.local_user_index, group_id);

    TestData {
        user1,
        user2,
        user3,
        group_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
}
