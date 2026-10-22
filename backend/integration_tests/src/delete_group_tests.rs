use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{metrics, tick_many, tick_until, wait_for_deleted_canister_to_be_uninstalled};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{CanisterId, ChatId};

#[test]
fn delete_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        platform_operator,
        ..
    } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids, *platform_operator);

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, multi_user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    wait_for_deleted_canister_to_be_uninstalled(env, group_id.into());
}

// An event which couldn't be delivered to a group is retried, which is pointless once the group has
// been deleted, so it's dropped
#[test]
fn events_queued_for_a_deleted_group_are_dropped() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(env, &user, &group_name, true, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    // An event which reaches a stopped canister is retried after 10 seconds, so with the clock
    // standing still it stays queued
    tick_many(env, 5);
    let queued_before = events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH);
    stop_canister(env, local_user_index, group_id.into());
    // Keeping the group's name, so that just the one event is sent
    client::group_index::happy_path::set_group_verification(env, *controller, canister_ids.group_index, group_id, group_name);
    wait_for_events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH, queued_before + 1);
    start_canister(env, local_user_index, group_id.into());

    let delete_group_response = client::user::delete_group(
        env,
        user.principal,
        user.canister(),
        &multi_user_canister::delete_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(delete_group_response, multi_user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );
    wait_for_deleted_canister_to_be_uninstalled(env, group_id.into());

    assert_eq!(
        events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH),
        queued_before
    );
}

// Members whose canisters are stopped when the group is deleted are told once they are running again
#[test]
fn user_canister_notified_of_group_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        platform_operator,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        group_id,
    } = init_test_data(env, canister_ids, *platform_operator);

    stop_canister(env, user2.local_user_index, user2.canister());
    stop_canister(env, user3.local_user_index, user3.canister());

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, multi_user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    env.tick();

    // The deleter's canister removed the group itself
    assert!(!holds_group(env, &user1, group_id));

    // The events for the stopped canisters are rejected and retried after a delay, so each member
    // is told once their canister is running again
    start_canister(env, user2.local_user_index, user2.canister());
    wait_for_group_deleted_notification(env, &user2, group_id);

    start_canister(env, user3.local_user_index, user3.canister());
    wait_for_group_deleted_notification(env, &user3, group_id);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, platform_operator: Principal) -> TestData {
    let user1 = client::register_user(env, canister_ids);
    // Each in a canister of their own, so that stopping it doesn't stop anyone else's
    let user2 = client::register_user_in_new_multi_user_canister(env, canister_ids, platform_operator);
    let user3 = client::register_user_in_new_multi_user_canister(env, canister_ids, platform_operator);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user1,
        canister_ids.local_user_index(env, group_id),
        group_id,
        vec![(user2.user_id, user2.principal), (user3.user_id, user3.principal)],
    );

    // The user canisters learn of the membership asynchronously (group -> local user index -> user
    // canister), and `user_canister_notified_of_group_deleted` stops user2 and user3 right after
    // this returns. A join event which reaches a stopped canister is retried, like the deletion
    // event, once the canister is running again, in no fixed order. A join which landed after the
    // deletion would leave the user holding the group, so the wait for the deletion to be applied
    // would never end. Wait for the memberships to land first.
    wait_for_group_membership(env, &user2, group_id);
    wait_for_group_membership(env, &user3, group_id);

    TestData {
        user1,
        user2,
        user3,
        group_id,
    }
}

// Ticks until the user's canister lists the group, ie. the join event has been delivered
fn wait_for_group_membership(env: &mut PocketIc, user: &User, group_id: ChatId) {
    for _ in 0..20 {
        if holds_group(env, user, group_id) {
            return;
        }
        env.tick();
    }
    panic!("User {} was not notified of joining the group", user.user_id);
}

// Ticks, moving time on so that the GroupIndex retries sending the event, until the user's canister
// no longer lists the group
fn wait_for_group_deleted_notification(env: &mut PocketIc, user: &User, group_id: ChatId) {
    tick_until(env, |env| !holds_group(env, user, group_id));
}

fn holds_group(env: &PocketIc, user: &User, group_id: ChatId) -> bool {
    client::user::happy_path::initial_state(env, user)
        .group_chats
        .summaries
        .iter()
        .any(|c| c.chat_id == group_id)
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
}

pub(crate) const GROUP_EVENTS_QUEUE_LENGTH: &str = "group_events_queue_length";

// The number of events queued by the LocalUserIndex for its groups or communities, excluding those
// being sent
pub(crate) fn events_queue_length(env: &PocketIc, local_user_index: CanisterId, metric: &str) -> u64 {
    metrics(env, local_user_index)[metric].as_u64().unwrap()
}

pub(crate) fn wait_for_events_queue_length(env: &mut PocketIc, local_user_index: CanisterId, metric: &str, length: u64) {
    for _ in 0..30 {
        if events_queue_length(env, local_user_index, metric) == length {
            return;
        }
        env.tick();
    }
    panic!("The {metric} metric did not reach {length}");
}
