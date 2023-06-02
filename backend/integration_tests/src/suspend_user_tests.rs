use crate::env::ENV;
use crate::rng::random_message_id;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use types::{MessageContentInitial, TextContent};

#[test]
fn suspend_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let group = client::user::happy_path::create_group(env, &user1, "SUSPEND_USER_TEST", false, false);
    let platform_moderator = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

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
            message_id: random_message_id(),
            sender_name: user1.username(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            forwarding: false,
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
        group.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_message_id(),
            sender_name: user1.username(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        group_message_response1,
        group_canister::send_message_v2::Response::UserSuspended
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
            message_id: random_message_id(),
            sender_name: user1.username(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            forwarding: false,
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
        group.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_message_id(),
            sender_name: user1.username(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        group_message_response2,
        group_canister::send_message_v2::Response::Success(_)
    ));
}

#[test]
fn suspend_user_for_duration() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let platform_moderator = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

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
            user_id: user.user_id,
            duration: Some(1000),
            reason: "spamming".to_string(),
        },
    );

    env.advance_time(Duration::from_millis(999));
    env.tick();

    let user_response1 = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert!(user_response1.suspension_details.is_some());

    env.advance_time(Duration::from_millis(1));
    env.tick();

    let user_response2 = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert!(user_response2.suspension_details.is_none());
}
