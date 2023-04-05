use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;
use types::{DiamondMembershipPlanDuration, GateCheckFailedReason, GroupGate, GroupRules};

#[test_case(true; "diamond_member")]
#[test_case(false; "not_diamond_member")]
fn public_group_diamond_member_gate_check(is_diamond: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let group_name = random_string();

    let group_id = match client::user::create_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions: None,
            rules: GroupRules::default(),
            subtype: None,
            events_ttl: None,
            gate: Some(GroupGate::DiamondMember),
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    if is_diamond {
        client::icrc1::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id.into(), 1_000_000_000);
        client::user_index::happy_path::pay_for_diamond_membership(
            env,
            user2.principal,
            canister_ids.user_index,
            DiamondMembershipPlanDuration::OneMonth,
            false,
        );
    }

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            correlation_id: 0,
        },
    );

    if is_diamond {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ),);
    } else {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::GateCheckFailed(GateCheckFailedReason::NotDiamondMember)
        ),);
    }
}

#[test]
fn private_group_diamond_member_gate_check() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user3 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let group_name = random_string();

    let group_id = match client::user::create_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::create_group::Args {
            is_public: false,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: false,
            permissions: None,
            rules: GroupRules::default(),
            subtype: None,
            events_ttl: None,
            gate: Some(GroupGate::DiamondMember),
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    client::icrc1::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id.into(), 1_000_000_000);
    client::user_index::happy_path::pay_for_diamond_membership(
        env,
        user2.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );

    let add_members_response = client::group::add_participants(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::add_participants::Args {
            user_ids: vec![user2.user_id, user3.user_id],
            added_by_name: user1.username(),
            allow_blocked_users: false,
            correlation_id: 0,
        },
    );

    if let group_canister::add_participants::Response::PartialSuccess(result) = add_members_response {
        assert_eq!(result.users_added, vec![user2.user_id]);
        assert_eq!(result.users_who_failed_gate_check, vec![user3.user_id]);
    }
}
