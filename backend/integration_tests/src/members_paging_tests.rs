use crate::env::ENV;
use crate::{TestEnv, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use std::collections::BTreeSet;
use std::ops::Deref;
use testing::rng::random_string;
use types::UserId;

// A client can ask `selected_initial` for only the first page of a chat's or community's members,
// then get the rest a page at a time, or look up the particular users it needs to know about

#[test]
fn group_members_are_returned_a_page_at_a_time() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let others: Vec<_> = (0..4).map(|_| client::register_user(env, canister_ids)).collect();
    let non_member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    for user in others.iter() {
        client::group::happy_path::join_group(env, user.principal, group_id);
    }
    let other_ids: BTreeSet<UserId> = others.iter().map(|u| u.user_id).collect();

    // Everyone is returned unless a limit is given
    let all = client::group::happy_path::selected_initial(env, owner.principal, group_id);
    assert_eq!(all.participants.len(), 1);
    assert_eq!(all.basic_members.iter().copied().collect::<BTreeSet<_>>(), other_ids);
    assert!(all.more_members_after.is_none());

    let group_canister::selected_initial::Response::Success(first) = client::group::selected_initial(
        env,
        owner.principal,
        group_id.into(),
        &group_canister::selected_initial::Args { max_members: Some(3) },
    ) else {
        panic!("'selected_initial' failed");
    };
    // The owner is returned as well as the first 3 of the others
    assert_eq!(first.participants.len(), 1);
    assert_eq!(first.participants[0].user_id, owner.user_id);
    assert_eq!(first.basic_members.len(), 3);
    assert_eq!(first.more_members_after, first.basic_members.last().copied());

    let group_canister::members::Response::Success(second) = client::group::members(
        env,
        owner.principal,
        group_id.into(),
        &group_canister::members::Args {
            after: first.more_members_after,
            max_results: 3,
        },
    ) else {
        panic!("'members' failed");
    };
    assert!(second.members.is_empty());
    assert_eq!(second.basic_members.len(), 1);
    assert!(second.more_members_after.is_none());
    assert_eq!(
        first
            .basic_members
            .iter()
            .chain(&second.basic_members)
            .copied()
            .collect::<BTreeSet<_>>(),
        other_ids
    );

    // Of the users looked up, those who are members are returned
    let group_canister::lookup_members::Response::Success(lookup) = client::group::lookup_members(
        env,
        owner.principal,
        group_id.into(),
        &group_canister::lookup_members::Args {
            user_ids: vec![others[0].user_id, non_member.user_id, owner.user_id],
        },
    ) else {
        panic!("'lookup_members' failed");
    };
    assert_eq!(
        lookup.members.iter().map(|m| m.user_id).collect::<Vec<_>>(),
        vec![others[0].user_id, owner.user_id]
    );

    // A page always holds at least one member
    let group_canister::members::Response::Success(one) = client::group::members(
        env,
        owner.principal,
        group_id.into(),
        &group_canister::members::Args {
            after: None,
            max_results: 0,
        },
    ) else {
        panic!("'members' failed");
    };
    assert_eq!(one.basic_members.len(), 1);
    assert_eq!(one.more_members_after, one.basic_members.last().copied());

    // No more than 1000 users can be looked up at once
    assert!(matches!(
        client::group::lookup_members(
            env,
            owner.principal,
            group_id.into(),
            &group_canister::lookup_members::Args {
                user_ids: (0..1001u32).map(|i| Principal::from_slice(&i.to_be_bytes()).into()).collect(),
            },
        ),
        group_canister::lookup_members::Response::Error(e) if e.matches_code(OCErrorCode::TooManyUsers)
    ));

    // Only members can page through or look up the members
    assert!(matches!(
        client::group::members(
            env,
            non_member.principal,
            group_id.into(),
            &group_canister::members::Args {
                after: None,
                max_results: 3,
            },
        ),
        group_canister::members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInChat)
    ));
    assert!(matches!(
        client::group::lookup_members(
            env,
            non_member.principal,
            group_id.into(),
            &group_canister::lookup_members::Args {
                user_ids: vec![owner.user_id],
            },
        ),
        group_canister::lookup_members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInChat)
    ));
}

#[test]
fn community_and_channel_members_are_returned_a_page_at_a_time() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let others: Vec<_> = (0..4).map(|_| client::register_user(env, canister_ids)).collect();
    let non_member = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    // Those who join the community are added to its public channels
    for user in others.iter() {
        client::community::happy_path::join_community(env, user.principal, community_id);
    }
    let other_ids: BTreeSet<UserId> = others.iter().map(|u| u.user_id).collect();

    // The community's members
    let all = client::community::happy_path::selected_initial(env, owner.principal, community_id);
    assert_eq!(all.members.len() + all.basic_members.len(), 5);
    assert!(all.more_members_after.is_none());

    let community_canister::selected_initial::Response::Success(first) = client::community::selected_initial(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::selected_initial::Args {
            invite_code: None,
            max_members: Some(3),
        },
    ) else {
        panic!("'selected_initial' failed");
    };
    assert_eq!(first.members.len(), 1);
    assert_eq!(first.members[0].user_id, owner.user_id);
    assert_eq!(first.basic_members.len(), 3);
    assert_eq!(first.more_members_after, first.basic_members.last().copied());

    let community_canister::members::Response::Success(second) = client::community::members(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::members::Args {
            invite_code: None,
            after: first.more_members_after,
            max_results: 3,
        },
    ) else {
        panic!("'members' failed");
    };
    assert!(second.members.is_empty());
    assert!(second.more_members_after.is_none());
    assert_eq!(
        first
            .basic_members
            .iter()
            .chain(&second.basic_members)
            .copied()
            .collect::<BTreeSet<_>>(),
        other_ids
    );

    let community_canister::lookup_members::Response::Success(lookup) = client::community::lookup_members(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::lookup_members::Args {
            invite_code: None,
            user_ids: vec![others[0].user_id, non_member.user_id, others[0].user_id],
        },
    ) else {
        panic!("'lookup_members' failed");
    };
    assert_eq!(
        lookup.members.iter().map(|m| m.user_id).collect::<Vec<_>>(),
        vec![others[0].user_id]
    );

    // The channel's members
    let community_canister::selected_channel_initial::Response::Success(first) = client::community::selected_channel_initial(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::selected_channel_initial::Args {
            channel_id,
            max_members: Some(3),
        },
    ) else {
        panic!("'selected_channel_initial' failed");
    };
    assert_eq!(first.members.len(), 1);
    assert_eq!(first.members[0].user_id, owner.user_id);
    assert_eq!(first.basic_members.len(), 3);
    assert_eq!(first.more_members_after, first.basic_members.last().copied());

    let community_canister::channel_members::Response::Success(second) = client::community::channel_members(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::channel_members::Args {
            channel_id,
            after: first.more_members_after,
            max_results: 3,
        },
    ) else {
        panic!("'channel_members' failed");
    };
    assert!(second.members.is_empty());
    assert!(second.more_members_after.is_none());
    assert_eq!(
        first
            .basic_members
            .iter()
            .chain(&second.basic_members)
            .copied()
            .collect::<BTreeSet<_>>(),
        other_ids
    );

    let community_canister::lookup_channel_members::Response::Success(lookup) = client::community::lookup_channel_members(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::lookup_channel_members::Args {
            channel_id,
            user_ids: vec![others[0].user_id, non_member.user_id],
        },
    ) else {
        panic!("'lookup_channel_members' failed");
    };
    assert_eq!(
        lookup.members.iter().map(|m| m.user_id).collect::<Vec<_>>(),
        vec![others[0].user_id]
    );
}

#[test]
fn members_of_a_private_community_can_only_be_got_by_its_members() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let non_member = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), false, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, false, random_string());

    // The owner can
    assert!(matches!(
        client::community::members(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::members::Args {
                invite_code: None,
                after: None,
                max_results: 3,
            },
        ),
        community_canister::members::Response::Success(_)
    ));
    assert!(matches!(
        client::community::channel_members(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::channel_members::Args {
                channel_id,
                after: None,
                max_results: 3,
            },
        ),
        community_canister::channel_members::Response::Success(_)
    ));

    // A user who isn't a member can't
    assert!(matches!(
        client::community::members(
            env,
            non_member.principal,
            community_id.into(),
            &community_canister::members::Args {
                invite_code: None,
                after: None,
                max_results: 3,
            },
        ),
        community_canister::members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInCommunity)
    ));
    assert!(matches!(
        client::community::lookup_members(
            env,
            non_member.principal,
            community_id.into(),
            &community_canister::lookup_members::Args {
                invite_code: None,
                user_ids: vec![owner.user_id],
            },
        ),
        community_canister::lookup_members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInCommunity)
    ));
    assert!(matches!(
        client::community::channel_members(
            env,
            non_member.principal,
            community_id.into(),
            &community_canister::channel_members::Args {
                channel_id,
                after: None,
                max_results: 3,
            },
        ),
        community_canister::channel_members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInCommunity)
    ));
    assert!(matches!(
        client::community::lookup_channel_members(
            env,
            non_member.principal,
            community_id.into(),
            &community_canister::lookup_channel_members::Args {
                channel_id,
                user_ids: vec![owner.user_id],
            },
        ),
        community_canister::lookup_channel_members::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotInCommunity)
    ));
}
