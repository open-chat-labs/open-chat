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
// the updates since a time from which some have been pruned is given the details in full instead,
// if it passes `max_members`, which only clients which can read them do. So is one asking for the
// updates since a time after which more updates have been made to the members than `max_members`.

const PAGE_SIZE: Option<u32> = Some(1000);

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

    let group_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) = updates_since(env, before, PAGE_SIZE) else {
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

    // The details in full are a first page of the size given, as for `selected_initial`
    let group_canister::selected_updates_v2::Response::SuccessSnapshot(page) = updates_since(env, before, Some(1)) else {
        panic!("Expected the details in full");
    };
    assert_eq!(page.basic_members.len(), 1);
    assert!(page.more_members_after.is_some());

    // The updates since a time from which none have been pruned are returned as usual
    let group_canister::selected_updates_v2::Response::Success(updates) = updates_since(env, after_user1_joined, PAGE_SIZE)
    else {
        panic!("Expected the updates");
    };
    let added: Vec<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, vec![user2.user_id]);

    // A client which doesn't pass `max_members` is given the updates which haven't been pruned, as
    // before, since it can't read the details in full
    let group_canister::selected_updates_v2::Response::Success(updates) = updates_since(env, before, None) else {
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
    let non_member = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());

    let before = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    // Those who join the community are added to its public channels
    client::community::happy_path::join_community(env, user1.principal, community_id);
    let after_user1_joined = now_millis(env);

    env.advance_time(Duration::from_millis(32 * DAY_IN_MS));
    client::community::happy_path::join_community(env, user2.principal, community_id);

    let community_updates = |env: &mut _, sender, updates_since, max_members| {
        client::community::selected_updates_v2(
            env,
            sender,
            community_id.into(),
            &community_canister::selected_updates_v2::Args {
                invite_code: None,
                updates_since,
                max_members,
            },
        )
    };
    let community_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) =
        community_updates(env, owner.principal, before, PAGE_SIZE)
    else {
        panic!("Expected the community's details in full");
    };
    let members: BTreeSet<UserId> = snapshot
        .members
        .iter()
        .map(|m| m.user_id)
        .chain(snapshot.basic_members.iter().copied())
        .collect();
    assert_eq!(members, BTreeSet::from([owner.user_id, user1.user_id, user2.user_id]));

    let community_canister::selected_updates_v2::Response::Success(updates) =
        community_updates(env, owner.principal, after_user1_joined, PAGE_SIZE)
    else {
        panic!("Expected the community's updates");
    };
    let added: Vec<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, vec![user2.user_id]);

    // As a first page if asked for one
    let community_canister::selected_updates_v2::Response::SuccessSnapshot(page) =
        community_updates(env, owner.principal, before, Some(1))
    else {
        panic!("Expected the community's details in full");
    };
    assert!(page.more_members_after.is_some());

    // To someone previewing the public community too
    assert!(matches!(
        community_updates(env, non_member.principal, before, PAGE_SIZE),
        community_canister::selected_updates_v2::Response::SuccessSnapshot(_)
    ));

    // But not to a client which doesn't pass `max_members`
    assert!(matches!(
        community_updates(env, owner.principal, before, None),
        community_canister::selected_updates_v2::Response::Success(_)
    ));

    let channel_updates = |env: &mut _, updates_since, max_members| {
        client::community::selected_channel_updates_v2(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_channel_updates_v2::Args {
                channel_id,
                updates_since,
                max_members,
            },
        )
    };
    let community_canister::selected_channel_updates_v2::Response::SuccessSnapshot(snapshot) =
        channel_updates(env, before, PAGE_SIZE)
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

    let community_canister::selected_channel_updates_v2::Response::Success(updates) =
        channel_updates(env, after_user1_joined, PAGE_SIZE)
    else {
        panic!("Expected the channel's updates");
    };
    let added: Vec<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, vec![user2.user_id]);

    let community_canister::selected_channel_updates_v2::Response::SuccessSnapshot(page) =
        channel_updates(env, before, Some(1))
    else {
        panic!("Expected the channel's details in full");
    };
    assert!(page.more_members_after.is_some());

    assert!(matches!(
        channel_updates(env, before, None),
        community_canister::selected_channel_updates_v2::Response::Success(_)
    ));
}

#[test]
fn group_details_are_returned_in_full_when_more_member_updates_since_than_max_members() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let users: Vec<_> = (0..3).map(|_| client::register_user(env, canister_ids)).collect();
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);

    let before = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    for user in users.iter() {
        client::group::happy_path::join_group(env, user.principal, group_id);
    }

    let updates_since = |env: &mut _, max_members| {
        client::group::selected_updates_v2(
            env,
            owner.principal,
            group_id.into(),
            &group_canister::selected_updates_v2::Args {
                updates_since: before,
                max_members,
            },
        )
    };

    // 3 members have been added since, more than 2
    let response = updates_since(env, Some(2));
    let group_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) = response else {
        panic!("Expected the details in full, got {response:?}");
    };
    assert_eq!(snapshot.basic_members.len(), 2);
    assert!(snapshot.more_members_after.is_some());

    // But not more than 3
    let response = updates_since(env, Some(3));
    let group_canister::selected_updates_v2::Response::Success(updates) = response else {
        panic!("Expected the updates, got {response:?}");
    };
    let added: BTreeSet<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, users.iter().map(|u| u.user_id).collect());

    // And a client which doesn't pass `max_members` is given the updates, as before
    assert!(matches!(
        updates_since(env, None),
        group_canister::selected_updates_v2::Response::Success(_)
    ));
}

#[test]
fn community_and_channel_details_are_returned_in_full_when_more_member_updates_since_than_max_members() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let users: Vec<_> = (0..3).map(|_| client::register_user(env, canister_ids)).collect();
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());

    let before = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    // Those who join the community are added to its public channels
    for user in users.iter() {
        client::community::happy_path::join_community(env, user.principal, community_id);
    }
    let user_ids: BTreeSet<UserId> = users.iter().map(|u| u.user_id).collect();

    let community_updates = |env: &mut _, max_members| {
        client::community::selected_updates_v2(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_updates_v2::Args {
                invite_code: None,
                updates_since: before,
                max_members,
            },
        )
    };

    let response = community_updates(env, Some(2));
    let community_canister::selected_updates_v2::Response::SuccessSnapshot(snapshot) = response else {
        panic!("Expected the community's details in full, got {response:?}");
    };
    assert_eq!(snapshot.basic_members.len(), 2);
    assert!(snapshot.more_members_after.is_some());

    let response = community_updates(env, Some(3));
    let community_canister::selected_updates_v2::Response::Success(updates) = response else {
        panic!("Expected the community's updates, got {response:?}");
    };
    let added: BTreeSet<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, user_ids);

    assert!(matches!(
        community_updates(env, None),
        community_canister::selected_updates_v2::Response::Success(_)
    ));

    let channel_updates = |env: &mut _, max_members| {
        client::community::selected_channel_updates_v2(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::selected_channel_updates_v2::Args {
                channel_id,
                updates_since: before,
                max_members,
            },
        )
    };

    let response = channel_updates(env, Some(2));
    let community_canister::selected_channel_updates_v2::Response::SuccessSnapshot(snapshot) = response else {
        panic!("Expected the channel's details in full, got {response:?}");
    };
    assert_eq!(snapshot.basic_members.len(), 2);
    assert!(snapshot.more_members_after.is_some());

    let response = channel_updates(env, Some(3));
    let community_canister::selected_channel_updates_v2::Response::Success(updates) = response else {
        panic!("Expected the channel's updates, got {response:?}");
    };
    let added: BTreeSet<UserId> = updates.members_added_or_updated.iter().map(|m| m.user_id).collect();
    assert_eq!(added, user_ids);

    assert!(matches!(
        channel_updates(env, None),
        community_canister::selected_channel_updates_v2::Response::Success(_)
    ));
}
