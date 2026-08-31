use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CommunityId, HttpRequest};

#[test]
fn delete_community_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, community_id, .. } = init_test_data(env, canister_ids, *controller);

    let delete_community_response = client::user::delete_community(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_community::Args { community_id },
    );

    assert!(
        matches!(delete_community_response, user_canister::delete_community::Response::Success),
        "{delete_community_response:?}",
    );

    tick_many(env, 5);

    assert!(!env.canister_exists(community_id.into()));
}

#[test]
fn user_canister_notified_of_community_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    stop_canister(env, user2.local_user_index, user2.canister());
    stop_canister(env, user3.local_user_index, user3.canister());

    let delete_community_response = client::user::delete_community(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_community::Args { community_id },
    );

    assert!(
        matches!(delete_community_response, user_canister::delete_community::Response::Success),
        "{delete_community_response:?}",
    );

    env.tick();

    let initial_state1 = client::user::happy_path::initial_state(env, &user1);
    assert!(
        !initial_state1
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id)
    );

    env.advance_time(Duration::from_secs(9 * 60));

    // The 9-minute retry to user2's stopped canister is rejected; user2 is then started and the
    // next attempt (still inside the 10 minute window) is delivered.
    tick_many(env, 3);

    start_canister(env, user2.local_user_index, user2.user_id.canister_id());

    env.tick();

    let initial_state2 = client::user::happy_path::initial_state(env, &user1);
    assert!(
        !initial_state2
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id)
    );

    // Inside the 10 minute window nothing can have been dropped yet, so this is a clean baseline
    let failed_before = community_deleted_notifications_failed(env, canister_ids.group_index);

    env.advance_time(Duration::from_secs(2 * 60));
    // Now past the 10 minute cutoff, so the remaining attempt to notify user3's stopped canister
    // must resolve (rejected) and be dropped before user3 is started - otherwise an in-flight
    // call would be delivered to the running canister and succeed. The pending count alone
    // cannot show this (it reads zero while the attempt is in flight), so wait for the drop
    // itself: group_index's failed count rising is the deterministic endpoint.
    wait_for_community_deleted_notification_dropped(env, canister_ids.group_index, failed_before);
    start_canister(env, user3.local_user_index, user3.user_id.canister_id());
    env.tick();

    // Only retry for 10 minutes so the notification shouldn't have made it to user3's canister
    let initial_state3 = client::user::happy_path::initial_state(env, &user3);
    assert!(
        initial_state3
            .communities
            .summaries
            .iter()
            .any(|c| c.community_id == community_id)
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    let community_name = random_string();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, false, vec![random_string()]);
    client::local_user_index::happy_path::add_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![(user2.user_id, user2.principal), (user3.user_id, user3.principal)],
    );

    TestData {
        user1,
        user2,
        user3,
        community_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    community_id: CommunityId,
}

fn community_deleted_notifications_failed(env: &mut PocketIc, group_index: Principal) -> u64 {
    let request = HttpRequest {
        method: "GET".to_string(),
        url: "/metrics".to_string(),
        headers: Vec::new(),
        body: Vec::new(),
    };
    let response = client::http_request(env, Principal::anonymous(), group_index, &request);
    let metrics: serde_json::Value = serde_json::from_slice(&response.body).unwrap();
    metrics["community_deleted_notifications_failed"].as_u64().unwrap()
}

// Ticks until group_index has dropped a community-deleted notification (an attempt which failed
// past the 10 minute retry window). Each user has a single entry which is either queued, in
// flight, or dropped, so once the failed count rises nothing for that user remains in flight.
fn wait_for_community_deleted_notification_dropped(env: &mut PocketIc, group_index: Principal, failed_before: u64) {
    for _ in 0..200 {
        env.tick();
        if community_deleted_notifications_failed(env, group_index) > failed_before {
            return;
        }
    }
    panic!("Community deleted notification was not dropped");
}
