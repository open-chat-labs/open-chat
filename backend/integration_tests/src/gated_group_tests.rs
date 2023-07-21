use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;
use types::{AccessGate, AccessRules, GateCheckFailedReason};

#[test_case(true; "diamond_member")]
#[test_case(false; "not_diamond_member")]
fn public_group_diamond_member_gate_check(is_diamond: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);

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
            rules: AccessRules::default(),
            events_ttl: None,
            gate: Some(AccessGate::DiamondMember),
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    let user2 = if is_diamond {
        client::register_diamond_user(env, canister_ids, *controller)
    } else {
        client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index)
    };

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
