use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, User, client};
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CanisterId, Document, OptionUpdate, TimestampMillis};

#[test]
fn update_username_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.advance_time(Duration::from_secs(10));

    let username = random_string();
    let now = now_millis(env);

    client::user_index::happy_path::set_username(env, user.principal, canister_ids.user_index, username.clone());

    // Check that the user index is updated
    let user_summary = client::user_index::happy_path::users(env, user.principal, canister_ids.user_index, vec![user.user_id])
        .current_user
        .unwrap();
    assert_eq!(user_summary.username, username);

    // Check that the user canister is updated
    wait_for_updates(env, &user, now - 1, |updates| updates.username.as_ref() == Some(&username));
}

#[test]
fn update_display_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);

    env.advance_time(Duration::from_secs(10));

    let display_name = random_string();
    let now = now_millis(env);

    client::user_index::happy_path::set_display_name(env, user.principal, canister_ids.user_index, Some(display_name.clone()));

    // Check that the user index is updated
    let user_summary = client::user_index::happy_path::users(env, user.principal, canister_ids.user_index, vec![user.user_id])
        .current_user
        .unwrap();
    assert_eq!(user_summary.display_name, Some(display_name.clone()));

    // Check that the user canister is updated
    let expected = OptionUpdate::SetToSome(display_name);
    wait_for_updates(env, &user, now - 1, |updates| updates.display_name == expected);
}

#[test]
fn update_profile_background_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.advance_time(Duration::from_secs(10));

    let id: u128 = random();

    client::user::happy_path::set_profile_background(
        env,
        &user,
        &user_canister::set_profile_background::Args {
            profile_background: Some(Document {
                id,
                data: vec![1; 1000],
                mime_type: "image/jpg".to_string(),
            }),
        },
    );

    // Check that the user index is updated
    wait_for_profile_background(env, &user, canister_ids.user_index, id);
}

// Ticks until the user's canister reports updates since the given time which satisfy the predicate.
// A change made in the UserIndex can take many rounds to get there, since a newly created User canister
// periodically takes around 10 rounds to handle its first message (seemingly while the wasm is compiled
// on its subnet), a number which grows with the size of the wasm.
fn wait_for_updates(
    env: &mut PocketIc,
    user: &User,
    updates_since: TimestampMillis,
    predicate: impl Fn(&user_canister::updates::SuccessResult) -> bool,
) {
    for _ in 0..30 {
        if client::user::happy_path::updates(env, user, updates_since).is_some_and(|updates| predicate(&updates)) {
            return;
        }
        env.tick();
    }
    panic!("User {}'s canister was not told of the update", user.user_id);
}

// Ticks until the UserIndex has been told of the user's new profile background by their canister
fn wait_for_profile_background(env: &mut PocketIc, user: &User, user_index: CanisterId, id: u128) {
    for _ in 0..10 {
        let user_summary = client::user_index::happy_path::users(env, user.principal, user_index, vec![user.user_id])
            .current_user
            .unwrap();
        if user_summary.profile_background_id == Some(id) {
            return;
        }
        env.tick();
    }
    panic!("The UserIndex was not told of user {}'s profile background", user.user_id);
}
