use crate::env::ENV;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{AccessGate, AccessGateNonComposite, CompositeGate, GateCheckFailedReason, Rules, TokenBalanceGate};

#[test_case(true, false; "diamond_member")]
#[test_case(false, false; "not_diamond_member")]
#[test_case(false, true; "is_invited")]
fn public_group_diamond_member_gate_check(is_diamond: bool, is_invited: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
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
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
            gate: None,
            gate_config: Some(AccessGate::DiamondMember.into()),
            messages_visible_to_non_members: None,
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    let user2 = if is_diamond {
        client::register_diamond_user(env, canister_ids, *controller)
    } else {
        client::register_user(env, canister_ids)
    };

    if is_invited {
        client::local_user_index::happy_path::invite_users_to_group(
            env,
            &user1,
            canister_ids.local_user_index,
            group_id,
            vec![user2.user_id],
        );
    }

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            correlation_id: 0,
        },
    );

    if is_diamond || is_invited {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ));
    } else {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::GateCheckFailed(GateCheckFailedReason::NotDiamondMember)
        ));
    }
}

#[test_case(true)]
#[test_case(false)]
fn public_group_token_balance_gate_check(has_sufficient_balance: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let min_balance = 1_000_000_000;

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
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
            gate: None,
            gate_config: Some(
                AccessGate::TokenBalance(TokenBalanceGate {
                    ledger_canister_id: canister_ids.icp_ledger,
                    min_balance,
                })
                .into(),
            ),
            messages_visible_to_non_members: None,
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    let amount = if has_sufficient_balance { min_balance } else { min_balance - 1 };

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id, amount);

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            correlation_id: 0,
        },
    );

    if has_sufficient_balance {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ));
    } else {
        assert!(
            matches!(
                join_group_response,
                local_user_index_canister::join_group::Response::GateCheckFailed(GateCheckFailedReason::InsufficientBalance(_))
            ),
            "{join_group_response:?}"
        );
    }
}

#[test_case(true, true, true)]
#[test_case(true, true, false)]
#[test_case(true, false, true)]
#[test_case(true, false, false)]
#[test_case(false, true, true)]
#[test_case(false, true, false)]
#[test_case(false, false, true)]
#[test_case(false, false, false)]
fn public_group_composite_gate_check(is_diamond: bool, has_sufficient_balance: bool, and_gate: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);

    let group_name = random_string();
    let min_balance = 1_000_000_000;

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
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
            gate: None,
            gate_config: Some(
                AccessGate::Composite(CompositeGate {
                    inner: vec![
                        AccessGateNonComposite::DiamondMember,
                        AccessGateNonComposite::TokenBalance(TokenBalanceGate {
                            ledger_canister_id: canister_ids.chat_ledger,
                            min_balance,
                        }),
                    ],
                    and: and_gate,
                })
                .into(),
            ),

            messages_visible_to_non_members: None,
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    let user2 = if is_diamond {
        client::register_diamond_user(env, canister_ids, *controller)
    } else {
        client::register_user(env, canister_ids)
    };

    let amount = if has_sufficient_balance { min_balance } else { min_balance - 1 };

    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, amount);

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            correlation_id: 0,
        },
    );

    let should_be_success = (is_diamond && has_sufficient_balance) || (!and_gate && (is_diamond || has_sufficient_balance));

    if should_be_success {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ));
    } else {
        assert!(matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::GateCheckFailed(_)
        ));
    }
}
