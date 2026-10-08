use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{ChatEvent, CommunityId, EventIndex, MessageContent};

#[test_case(true)]
#[test_case(false)]
fn block_user_succeeds(user_has_left_community: bool) {
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
        community_id,
        community_name,
    } = init_test_data(env, canister_ids, *controller, true, true);

    if user_has_left_community {
        client::user::happy_path::leave_community(env, &user2, community_id);
    }

    // Block user2
    let block_user_response = client::community::block_user(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::block_user::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        block_user_response,
        community_canister::block_user::Response::Success
    ));

    // Check user has been blocked
    let response = client::community::happy_path::selected_initial(env, user1.principal, community_id);

    assert!(response.blocked_users.contains(&user2.user_id));
    assert!(!response.members.iter().any(|member| member.user_id == user2.user_id));

    if !user_has_left_community {
        tick_many(env, 3);

        // Check user canister that user is no longer in community
        let initial_state = client::user::happy_path::initial_state(env, &user2);
        assert!(
            !initial_state
                .communities
                .summaries
                .iter()
                .any(|c| c.community_id == community_id)
        );

        // Check bot message received
        let user1_id = user1.user_id;
        assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
            if let MessageContent::Text(content) = &dc.latest_message.as_ref().unwrap().event.content {
                content.text
                    == format!("You were blocked from the public community \"{community_name}\" by @UserId({user1_id})")
            } else {
                false
            }
        }));
    }
}

#[test]
fn block_user_fails_for_private_communities() {
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
        community_id,
        community_name: _,
    } = init_test_data(env, canister_ids, *controller, false, true);

    let block_user_response = client::community::block_user(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::block_user::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        block_user_response,
        community_canister::block_user::Response::Error(e) if e.matches_code(OCErrorCode::CommunityNotPublic)
    ));
}

#[test]
fn remove_user_succeeds() {
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
        community_id,
        community_name,
    } = init_test_data(env, canister_ids, *controller, false, true);

    // Remove user2
    let remove_member_response = client::community::remove_member(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        remove_member_response,
        community_canister::remove_member::Response::Success
    ));

    // Check user has been removed
    let response = client::community::happy_path::selected_initial(env, user1.principal, community_id);

    assert!(!response.blocked_users.contains(&user2.user_id));
    assert!(!response.members.iter().any(|member| member.user_id == user2.user_id));
    assert!(!response.referrals.contains(&user2.user_id));

    tick_many(env, 3);

    // Check user canister that user is no longer in community
    let initial_state = client::user::happy_path::initial_state(env, &user2);
    assert!(
        !initial_state
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id)
    );

    // Check bot message received
    let user1_id = user1.user_id;
    let removed_text = format!("You were removed from the private community \"{community_name}\" by @UserId({user1_id})");
    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.as_ref().unwrap().event.content {
            content.text == removed_text
        } else {
            false
        }
    }));

    // The user's canister is told of the removal both directly and via the community's queue of
    // events for users, but only the first does anything, so the bot's message is sent once
    tick_many(env, 3);
    assert_eq!(bot_messages(env, &user2, &removed_text), 1);
}

// The direct call to the user's canister is retried for about 21 minutes. A canister unreachable for
// longer is still told, via the community's queue of events for users.
#[test]
fn removal_reaches_a_user_canister_unreachable_for_longer_than_the_direct_call_is_retried() {
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
        community_id,
        community_name,
    } = init_test_data(env, canister_ids, *controller, false, true);

    stop_canister(env, user2.local_user_index, user2.canister());

    let remove_member_response = client::community::remove_member(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member::Args { user_id: user2.user_id },
    );
    assert!(matches!(
        remove_member_response,
        community_canister::remove_member::Response::Success
    ));

    // The direct call makes 50 retries, each a second further apart than the last, so one per minute
    // here, with enough rounds each minute for a call to another subnet to complete
    for _ in 0..60 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 10);
    }

    start_canister(env, user2.local_user_index, user2.canister());

    let mut removed = false;
    for _ in 0..10 {
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 3);
        let initial_state = client::user::happy_path::initial_state(env, &user2);
        if !initial_state
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id)
        {
            removed = true;
            break;
        }
    }
    assert!(removed);

    let user1_id = user1.user_id;
    let removed_text = format!("You were removed from the private community \"{community_name}\" by @UserId({user1_id})");
    assert_eq!(bot_messages(env, &user2, &removed_text), 1);
}

// The number of messages from the OpenChat bot to the user with the given text
fn bot_messages(env: &PocketIc, user: &User, text: &str) -> usize {
    client::user::happy_path::events(env, user, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
        .events
        .iter()
        .filter(|event| {
            matches!(&event.event, ChatEvent::Message(m)
                if matches!(&m.content, MessageContent::Text(content) if content.text == text))
        })
        .count()
}

#[test]
fn community_referral_added_and_removed() {
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
        community_id,
        community_name: _,
    } = init_test_data(env, canister_ids, *controller, false, true);

    // Check the referral has been added - method 1
    let response1 = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert!(response1.referrals.contains(&user2.user_id));

    // Check the referral has been added - method 2
    let response2 =
        client::community::happy_path::selected_updates(env, user1.principal, community_id, 0).expect("Expected updates");
    assert!(response2.referrals_added.contains(&user2.user_id));
    assert!(response2.referrals_removed.is_empty());

    env.advance_time(Duration::from_secs(1));

    // Remove user2
    let remove_member_response = client::community::remove_member(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        remove_member_response,
        community_canister::remove_member::Response::Success
    ));

    // Check the referral has been removed - method 1
    let response3 = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert!(response3.referrals.is_empty());

    // Check the referral has been removed - method 2
    let response4 = client::community::happy_path::selected_updates(env, user1.principal, community_id, response1.timestamp)
        .expect("Expected updates");
    assert!(response4.referrals_added.is_empty());
    assert!(response4.referrals_removed.contains(&user2.user_id));
}

#[test_case(true)]
#[test_case(false)]
fn remove_invite_succeeds(user_joins_community: bool) {
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
        community_id,
        ..
    } = init_test_data(env, canister_ids, *controller, false, user_joins_community);

    // Remove user2
    let remove_member_response = client::community::remove_member(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        remove_member_response,
        community_canister::remove_member::Response::Success
    ));

    // Check user invite has been removed
    let response = client::community::happy_path::selected_initial(env, user1.principal, community_id);

    assert!(!response.invited_users.contains(&user2.user_id));
    assert!(!response.members.iter().any(|member| member.user_id == user2.user_id));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, public: bool, join: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let community_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, public, vec!["abcde".to_string()]);

    if !public {
        client::local_user_index::happy_path::invite_users_to_community(
            env,
            &user1,
            canister_ids.local_user_index(env, community_id),
            community_id,
            vec![user2.user_id],
        );
    }

    if join {
        client::community::happy_path::join_community(env, user2.principal, community_id);
    }

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        community_id,
        community_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    community_name: String,
}
