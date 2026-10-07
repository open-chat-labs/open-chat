use crate::bot_tests::register_bot;
use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{metrics, tick_many, wait_for_deleted_canister_to_be_uninstalled};
use crate::{CanisterIds, TestEnv, User, client};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{BotInstallationLocation, BotPermissions, CanisterId, ChatId};

#[test]
fn delete_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids);

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
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
        &user_canister::delete_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );
    wait_for_deleted_canister_to_be_uninstalled(env, group_id.into());

    assert_eq!(
        events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH),
        queued_before
    );
}

// The UserIndex isn't told when a group is deleted, so a bot which was installed in it is still
// listed there, and removing the bot sends the group an event
#[test]
fn events_for_a_deleted_group_are_not_queued() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);
    let (bot_id, _) = register_bot(env, &user, canister_ids.user_index, random_string(), random_string());
    tick_many(env, 3);

    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::default(),
        None,
    );
    tick_many(env, 3);

    let delete_group_response = client::user::delete_group(
        env,
        user.principal,
        user.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );
    wait_for_deleted_canister_to_be_uninstalled(env, group_id.into());

    // A batch for a group which isn't local is also dropped once sending it fails, so this doesn't
    // tell whether the event was queued at all. See the unit test in the LocalUserIndex for that.
    let queued_before = events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH);
    client::user_index::happy_path::remove_bot(env, user.principal, canister_ids.user_index, bot_id);
    tick_many(env, 10);

    assert_eq!(
        events_queue_length(env, local_user_index, GROUP_EVENTS_QUEUE_LENGTH),
        queued_before
    );
}

#[test]
fn user_canister_notified_of_group_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        group_id,
    } = init_test_data(env, canister_ids);

    stop_canister(env, user2.local_user_index, user2.canister());
    stop_canister(env, user3.local_user_index, user3.canister());

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    env.tick();

    let initial_state1 = client::user::happy_path::initial_state(env, &user1);
    assert!(!initial_state1.group_chats.summaries.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(9 * 60));
    env.tick();
    start_canister(env, user2.local_user_index, user2.user_id.canister_id());
    env.tick();

    let initial_state2 = client::user::happy_path::initial_state(env, &user1);
    assert!(!initial_state2.group_chats.summaries.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(2 * 60));
    env.tick();
    start_canister(env, user3.local_user_index, user3.user_id.canister_id());
    env.tick();

    // Only retry for 10 minutes so the notification shouldn't have made it to user3's canister
    let initial_state3 = client::user::happy_path::initial_state(env, &user3);
    assert!(initial_state3.group_chats.summaries.iter().any(|c| c.chat_id == group_id));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds) -> TestData {
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

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
    // this returns. A join event which reaches a stopped canister is rejected and only retried
    // after a 10 second delay, which never elapses while the clock stands still, so a user stopped
    // before its join landed would never hold the group and the final assertion (that user3 still
    // has it) would fail. Wait for the memberships to land first.
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
        let initial_state = client::user::happy_path::initial_state(env, user);
        if initial_state.group_chats.summaries.iter().any(|c| c.chat_id == group_id) {
            return;
        }
        env.tick();
    }
    panic!("User {} was not notified of joining the group", user.user_id);
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
}

pub(crate) const GROUP_EVENTS_QUEUE_LENGTH: &str = "group_events_queue_length";
pub(crate) const COMMUNITY_EVENTS_QUEUE_LENGTH: &str = "community_events_queue_length";

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
