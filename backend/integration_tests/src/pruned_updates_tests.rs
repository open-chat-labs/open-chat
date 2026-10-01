use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use constants::DAY_IN_MS;
use std::collections::BTreeSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::UserId;

// Canisters keep the updates to a chat's or community's details for 31 days. A client asking for
// the updates since a time from which some have been pruned is given the details in full instead.

#[test]
fn group_details_are_returned_in_full_once_updates_since_have_been_pruned() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);

    let before = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    client::group::happy_path::join_group(env, user1.principal, group_id);
    let after_user1_joined = now_millis(env);

    // The update of user1 joining is pruned when the next update is made
    env.advance_time(Duration::from_millis(32 * DAY_IN_MS));
    client::group::happy_path::join_group(env, user2.principal, group_id);

    let updates_since = |env: &mut _, updates_since, max_members| {
        client::group::selected_updates_v2(
            env,
            owner.principal,
            group_id.into(),
            &group_canister::selected_updates_v2::Args {
                updates_since,
                max_members,
            },
        )
    };

    let group_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) = updates_since(env, before, None) else {
        panic!("Expected the details in full");
    };
    let members: BTreeSet<UserId> = snapshot
        .participants
        .iter()
        .map(|m| m.user_id)
        .chain(snapshot.basic_members.iter().copied())
        .collect();
    assert_eq!(members, BTreeSet::from([owner.user_id, user1.user_id, user2.user_id]));
    assert!(snapshot.more_members_after.is_none());

    // The details in full are a first page if a page size is given, as for `selected_initial`
    let group_canister::selected_updates_v2::Response::SuccessSnapshot(page) = updates_since(env, before, Some(1)) else {
        panic!("Expected the details in full");
    };
    assert_eq!(page.basic_members.len(), 1);
    assert!(page.more_members_after.is_some());

    // The updates since a time from which none have been pruned are returned as usual
    let group_canister::selected_updates_v2::Response::Success(updates) = updates_since(env, after_user1_joined, None) else {
        panic!("Expected the updates");
    };
    let added: Vec<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, vec![user2.user_id]);
}

#[test]
fn community_and_channel_details_are_returned_in_full_once_updates_since_have_been_pruned() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());

    let before = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    // Those who join the community are added to its public channels
    client::community::happy_path::join_community(env, user1.principal, community_id);
    let after_user1_joined = now_millis(env);

    env.advance_time(Duration::from_millis(32 * DAY_IN_MS));
    client::community::happy_path::join_community(env, user2.principal, community_id);

    let community_updates = |env: &mut _, updates_since| {
        client::community::selected_updates_v2(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_updates_v2::Args {
                invite_code: None,
                updates_since,
                max_members: None,
            },
        )
    };
    let community_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) = community_updates(env, before) else {
        panic!("Expected the community's details in full");
    };
    let members: BTreeSet<UserId> = snapshot
        .members
        .iter()
        .map(|m| m.user_id)
        .chain(snapshot.basic_members.iter().copied())
        .collect();
    assert_eq!(members, BTreeSet::from([owner.user_id, user1.user_id, user2.user_id]));
    assert!(matches!(
        community_updates(env, after_user1_joined),
        community_canister::selected_updates_v2::Response::Success(_)
    ));

    let channel_updates = |env: &mut _, updates_since| {
        client::community::selected_channel_updates_v2(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_channel_updates_v2::Args {
                channel_id,
                updates_since,
                max_members: None,
            },
        )
    };
    let community_canister::selected_channel_updates_v2::Response::SuccessSnapshot(snapshot) = channel_updates(env, before)
    else {
        panic!("Expected the channel's details in full");
    };
    let members: BTreeSet<UserId> = snapshot
        .members
        .iter()
        .map(|m| m.user_id)
        .chain(snapshot.basic_members.iter().copied())
        .collect();
    assert_eq!(members, BTreeSet::from([owner.user_id, user1.user_id, user2.user_id]));
    assert!(matches!(
        channel_updates(env, after_user1_joined),
        community_canister::selected_channel_updates_v2::Response::Success(_)
    ));
}
