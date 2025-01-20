use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use group_index_canister::{
    revoke_community_verification, revoke_group_verification, set_community_verification, set_group_verification,
};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use types::{ChatId, CommunityId};

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

    let TestData {
        user,
        group_id,
        community_id,
    } = init_test_data(env, canister_ids, *controller, &community_name, &group_name);

    let initial_time = now_millis(env);
    env.advance_time(Duration::from_secs(10));

    // Set community verification and take group name
    let response = client::group_index::set_community_verification(
        env,
        *controller,
        canister_ids.group_index,
        &set_community_verification::Args {
            community_id,
            name: group_name.clone(),
        },
    );
    assert!(matches!(response, set_community_verification::Response::Success));

    let matches = client::group_index::happy_path::explore_communities(env, &user, canister_ids.group_index);
    let community_match = matches.into_iter().find(|m| m.id == community_id).unwrap();
    assert!(community_match.verified);
    assert_eq!(&community_match.name, &group_name);

    let matches = client::group_index::happy_path::explore_groups(env, &user, canister_ids.group_index);
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

    let matches = client::group_index::happy_path::explore_communities(env, &user, canister_ids.group_index);
    let community_match = matches.into_iter().find(|m| m.id == community_id).unwrap();
    assert!(!community_match.verified);

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
    let response = client::group_index::set_group_verification(
        env,
        *controller,
        canister_ids.group_index,
        &set_group_verification::Args {
            group_id,
            name: group_name.clone(),
        },
    );
    assert!(matches!(response, set_group_verification::Response::Success));

    let matches = client::group_index::happy_path::explore_groups(env, &user, canister_ids.group_index);
    let group_match = matches.into_iter().find(|m| m.id == group_id).unwrap();
    assert!(group_match.verified);
    assert_eq!(&group_match.name, &group_name);

    let matches = client::group_index::happy_path::explore_communities(env, &user, canister_ids.group_index);
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

    let matches = client::group_index::happy_path::explore_groups(env, &user, canister_ids.group_index);
    let group_match = matches.into_iter().find(|m| m.id == group_id).unwrap();
    assert!(!group_match.verified);

    tick_many(env, 3);
    env.advance_time(Duration::from_secs(10));

    let Some(updates) =
        client::group::happy_path::summary_updates(env, user.principal, group_id, time_after_group_verification)
    else {
        panic!("expected group::summary_updates");
    };
    assert_eq!(updates.verified, Some(false));
}

fn init_test_data(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    community_name: &str,
    group_name: &str,
) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);

    let community_id =
        client::user::happy_path::create_community(env, &user, community_name, true, vec!["general".to_string()]);

    let group_id = client::user::happy_path::create_group(env, &user, group_name, true, true);

    TestData {
        user,
        community_id,
        group_id,
    }
}

struct TestData {
    user: User,
    community_id: CommunityId,
    group_id: ChatId,
}
