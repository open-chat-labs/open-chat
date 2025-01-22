use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use candid::Principal;
use group_index_canister::{revoke_community_verification, revoke_group_verification, set_group_verification};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CanisterId, ChatId, CommunityId};

#[test]
fn e2e_group_and_community_verification_test() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let group_name = "DFINITY".to_string();
    let community_name = "The real DFINITY".to_string();

    let user = client::register_diamond_user(env, canister_ids, *controller);

    let community_id =
        client::user::happy_path::create_community(env, &user, &community_name, true, vec!["general".to_string()]);

    let group_id = client::user::happy_path::create_group(env, &user, &group_name, true, true);

    let initial_time = now_millis(env);
    env.advance_time(Duration::from_secs(10));

    // Set community verification and take group name
    client::group_index::happy_path::set_community_verification(
        env,
        *controller,
        canister_ids.group_index,
        community_id,
        group_name.clone(),
    );

    let matches = client::group_index::happy_path::explore_communities(env, user.principal, canister_ids.group_index);
    let community_match = matches.into_iter().find(|m| m.id == community_id).unwrap();
    assert!(community_match.verified);
    assert_eq!(&community_match.name, &group_name);

    let matches = client::group_index::happy_path::explore_groups(env, user.principal, canister_ids.group_index);
    let group_match = matches.into_iter().find(|m| m.id == group_id).unwrap();
    assert!(!group_match.verified);

    let new_group_name = group_match.name.clone();
    println!("new group name: {}", &new_group_name);

    assert_ne!(&new_group_name, &group_name);
    assert!(group_match.name.starts_with(&group_name));

    tick_many(env, 3);
    let time_after_community_verification = now_millis(env);
    env.advance_time(Duration::from_secs(10));

    let Some(updates) = client::community::happy_path::summary_updates(env, user.principal, community_id, initial_time) else {
        panic!("expected community::summary_updates");
    };
    assert_eq!(updates.verified, Some(true));
    assert!(updates.name.is_some());
    assert_eq!(&updates.name.unwrap(), &group_name);

    let Some(updates) = client::group::happy_path::summary_updates(env, user.principal, group_id, initial_time) else {
        panic!("expected group::summary_updates");
    };
    assert_eq!(updates.verified, None);
    assert_eq!(updates.name, Some(new_group_name));

    // Try to set group verification with original group name but fail with NameTaken
    let response = client::group_index::set_group_verification(
        env,
        *controller,
        canister_ids.group_index,
        &set_group_verification::Args {
            group_id,
            name: group_name.clone(),
        },
    );
    assert!(matches!(response, set_group_verification::Response::NameTaken));

    // Revoke community verification
    let response = client::group_index::revoke_community_verification(
        env,
        *controller,
        canister_ids.group_index,
        &revoke_community_verification::Args { community_id },
    );
    assert!(matches!(response, revoke_community_verification::Response::Success));

    assert_community_verification_status(env, user.principal, community_id, canister_ids.group_index, false);

    tick_many(env, 3);
    let time_after_community_unverified = now_millis(env);
    env.advance_time(Duration::from_secs(10));

    let Some(updates) =
        client::community::happy_path::summary_updates(env, user.principal, community_id, time_after_community_verification)
    else {
        panic!("expected community::summary_updates");
    };
    assert_eq!(updates.verified, Some(false));

    // Set group verification with original group name
    client::group_index::happy_path::set_group_verification(
        env,
        *controller,
        canister_ids.group_index,
        group_id,
        group_name.clone(),
    );

    let matches = client::group_index::happy_path::explore_groups(env, user.principal, canister_ids.group_index);
    let group_match = matches.into_iter().find(|m| m.id == group_id).unwrap();
    assert!(group_match.verified);
    assert_eq!(&group_match.name, &group_name);

    let matches = client::group_index::happy_path::explore_communities(env, user.principal, canister_ids.group_index);
    let community_match = matches.into_iter().find(|m| m.id == community_id).unwrap();
    assert!(!community_match.verified);

    let new_community_name = community_match.name.clone();
    println!("new community name: {}", &new_community_name);

    assert_ne!(&new_community_name, &group_name);
    assert!(community_match.name.starts_with(&group_name));

    tick_many(env, 3);
    let time_after_group_verification = now_millis(env);
    env.advance_time(Duration::from_secs(10));

    let Some(updates) =
        client::group::happy_path::summary_updates(env, user.principal, group_id, time_after_community_unverified)
    else {
        panic!("expected group::summary_updates");
    };
    assert_eq!(updates.verified, Some(true));
    assert!(updates.name.is_some());
    assert_eq!(&updates.name.unwrap(), &group_name);

    let Some(updates) =
        client::community::happy_path::summary_updates(env, user.principal, community_id, time_after_community_unverified)
    else {
        panic!("expected community::summary_updates");
    };
    assert_eq!(updates.verified, None);
    assert_eq!(updates.name, Some(new_community_name));

    // Revoke group verification
    let response = client::group_index::revoke_group_verification(
        env,
        *controller,
        canister_ids.group_index,
        &revoke_group_verification::Args { group_id },
    );
    assert!(matches!(response, revoke_group_verification::Response::Success));

    assert_group_verification_status(env, user.principal, group_id, canister_ids.group_index, false);

    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));

    let Some(updates) =
        client::group::happy_path::summary_updates(env, user.principal, group_id, time_after_group_verification)
    else {
        panic!("expected group::summary_updates");
    };
    assert_eq!(updates.verified, Some(false));
}

#[test]
fn group_verification_revoked_if_name_changed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(env, &user, &group_name, true, true);

    client::group_index::happy_path::set_group_verification(
        env,
        *controller,
        canister_ids.group_index,
        group_id,
        group_name.clone(),
    );

    env.tick();

    assert_group_verification_status(env, user.principal, group_id, canister_ids.group_index, true);

    client::group::happy_path::update_group(
        env,
        user.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: Some(random_string()),
            ..Default::default()
        },
    );

    assert_group_verification_status(env, user.principal, group_id, canister_ids.group_index, false);
}

#[test]
fn community_verification_revoked_if_name_changed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_name = random_string();
    let community_id = client::user::happy_path::create_community(env, &user, &community_name, true, vec![random_string()]);

    client::group_index::happy_path::set_community_verification(
        env,
        *controller,
        canister_ids.group_index,
        community_id,
        community_name.clone(),
    );

    env.tick();

    assert_community_verification_status(env, user.principal, community_id, canister_ids.group_index, true);

    client::community::happy_path::update_community(
        env,
        user.principal,
        community_id,
        &community_canister::update_community::Args {
            name: Some(random_string()),
            ..Default::default()
        },
    );

    assert_community_verification_status(env, user.principal, community_id, canister_ids.group_index, false);
}

fn assert_group_verification_status(
    env: &PocketIc,
    sender: Principal,
    group_id: ChatId,
    group_index: CanisterId,
    verified: bool,
) {
    let matches = client::group_index::happy_path::explore_groups(env, sender, group_index);
    let group_match = matches.into_iter().find(|m| m.id == group_id).unwrap();
    assert_eq!(group_match.verified, verified);

    let summary = client::group::happy_path::summary(env, sender, group_id);
    assert_eq!(summary.verified, verified);
}

fn assert_community_verification_status(
    env: &PocketIc,
    sender: Principal,
    community_id: CommunityId,
    group_index: CanisterId,
    verified: bool,
) {
    let matches = client::group_index::happy_path::explore_communities(env, sender, group_index);
    let community_match = matches.into_iter().find(|m| m.id == community_id).unwrap();
    assert_eq!(community_match.verified, verified);

    let summary = client::community::happy_path::summary(env, sender, community_id);
    assert_eq!(summary.verified, verified);
}
