use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::ChatId;

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

    tick_many(env, 5);

    assert!(!env.canister_exists(group_id.into()));
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

    env.stop_canister(user2.canister(), Some(user2.local_user_index)).unwrap();

    env.stop_canister(user3.canister(), Some(user3.local_user_index)).unwrap();

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

    env.start_canister(user2.user_id.into(), Some(user2.local_user_index))
        .unwrap();

    env.tick();

    let initial_state2 = client::user::happy_path::initial_state(env, &user1);
    assert!(!initial_state2.group_chats.summaries.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(2 * 60));

    env.tick();

    env.start_canister(user3.user_id.into(), Some(user3.local_user_index))
        .unwrap();

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
