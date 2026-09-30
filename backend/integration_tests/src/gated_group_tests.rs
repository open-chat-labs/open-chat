use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{AccessGate, AccessGateNonComposite, CompositeGate, GateCheckFailedReason, PaymentGate, Rules, TokenBalanceGate};

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
        user1.user_id.canister_id(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
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
            canister_ids.local_user_index(env, group_id),
            group_id,
            vec![user2.user_id],
        );
    }

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: None,
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
        user1.user_id.canister_id(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: None,
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
        user1.user_id.canister_id(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: None,
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

#[test_case(true)]
#[test_case(false)]
fn owner_receives_transfer_after_user_joins_via_payment_gate(composite_gate: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let original_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);

    let group_name = random_string();
    let amount = 1_0000_0000;
    let fee = 10_000;

    let payment_gate = PaymentGate {
        ledger_canister_id: canister_ids.icp_ledger,
        amount,
        fee,
    };

    let gate = if composite_gate {
        AccessGate::Composite(CompositeGate {
            inner: vec![
                AccessGateNonComposite::DiamondMember,
                AccessGateNonComposite::Payment(payment_gate),
            ],
            and: false,
        })
    } else {
        AccessGate::Payment(payment_gate)
    };

    let group_id = match client::user::create_group(
        env,
        user1.principal,
        user1.user_id.canister_id(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
            gate_config: Some(gate.into()),
            messages_visible_to_non_members: None,
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id, amount);
    client::ledger::happy_path::approve(
        env,
        user2.user_id.canister_id(),
        canister_ids.icp_ledger,
        Principal::from(group_id),
        amount - fee,
    );
    client::group::happy_path::join_group(env, user2.principal, group_id);

    tick_many(env, 3);

    let balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);

    assert_eq!(balance - original_balance, (amount * 98) / 100);
}

// A user in a MultiUser canister holds their own funds, in their principal's account, so the
// website approves the group or community to pull a gate's payment from there, on the ledger
// itself, as the user's canister does for a user alone in it. The group or community then pulls it
// when they join, just as from a User canister.
#[test_case(false; "group")]
#[test_case(true; "community")]
fn user_in_multi_user_canister_pays_payment_gate_from_their_wallet(community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user_in_multi_user_canister(env, canister_ids);

    let amount = 1_0000_0000;
    let fee = 10_000;
    let gate = AccessGate::Payment(PaymentGate {
        ledger_canister_id: canister_ids.icp_ledger,
        amount,
        fee,
    });
    let name = random_string();

    let spender = if community {
        match client::user::create_community(
            env,
            owner.principal,
            owner.canister(),
            &user_canister::create_community::Args {
                is_public: true,
                name: name.clone(),
                description: format!("{name}_description"),
                rules: Rules::default(),
                avatar: None,
                banner: None,
                history_visible_to_new_joiners: true,
                permissions: None,
                gate_config: Some(gate.into()),
                default_channels: vec![random_string()],
                default_channel_rules: None,
                primary_language: "en".to_string(),
            },
        ) {
            user_canister::create_community::Response::Success(result) => Principal::from(result.community_id),
            response => panic!("'create_community' error: {response:?}"),
        }
    } else {
        match client::user::create_group(
            env,
            owner.principal,
            owner.canister(),
            &user_canister::create_group::Args {
                is_public: true,
                name: name.clone(),
                description: format!("{name}_description"),
                avatar: None,
                history_visible_to_new_joiners: true,
                permissions_v2: None,
                rules: Rules::default(),
                events_ttl: None,
                gate_config: Some(gate.into()),
                messages_visible_to_non_members: None,
            },
        ) {
            user_canister::create_group::Response::Success(result) => Principal::from(result.chat_id),
            response => panic!("'create_group' error: {response:?}"),
        }
    };

    let owner_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner.user_id);

    // The wallet holds the gate's amount, and approves the gate's amount less the approval's fee
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.principal, amount);
    client::ledger::happy_path::approve(env, user.principal, canister_ids.icp_ledger, spender, amount - fee);

    if community {
        client::community::happy_path::join_community(env, user.principal, spender.into());
    } else {
        client::group::happy_path::join_group(env, user.principal, spender.into());
    }

    tick_many(env, 3);

    // The gate took exactly its amount from the wallet, of which the owner was paid their share
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.principal),
        0
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner.user_id) - owner_balance,
        (amount * 98) / 100
    );
}

#[test]
fn only_selected_composite_gate_checked_if_index_provided() {
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
        user1.user_id.canister_id(),
        &user_canister::create_group::Args {
            is_public: true,
            name: group_name.clone(),
            description: format!("{group_name}_description"),
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            rules: Rules::default(),
            events_ttl: None,
            gate_config: Some(
                AccessGate::Composite(CompositeGate {
                    inner: vec![
                        AccessGateNonComposite::Payment(PaymentGate {
                            ledger_canister_id: canister_ids.icp_ledger,
                            amount: 1_0000_0000,
                            fee: 10_000,
                        }),
                        AccessGateNonComposite::Payment(PaymentGate {
                            ledger_canister_id: canister_ids.chat_ledger,
                            amount: 1_0000_0000,
                            fee: 100_000,
                        }),
                    ],
                    and: false,
                })
                .into(),
            ),
            messages_visible_to_non_members: None,
        },
    ) {
        user_canister::create_group::Response::Success(result) => result.chat_id,
        response => panic!("'create_group' error: {response:?}"),
    };

    let user2 = client::register_user(env, canister_ids);

    let initial_balance = 10_0000_0000;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id, initial_balance);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, initial_balance);

    client::ledger::happy_path::approve(
        env,
        user2.user_id.canister_id(),
        canister_ids.icp_ledger,
        Principal::from(group_id),
        initial_balance,
    );
    client::ledger::happy_path::approve(
        env,
        user2.user_id.canister_id(),
        canister_ids.chat_ledger,
        Principal::from(group_id),
        initial_balance,
    );

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: Some(1),
        },
    );

    assert!(
        matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ),
        "{join_group_response:?}"
    );

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        initial_balance - 10_000
    );
    assert!(client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id) < initial_balance - 100_000);
}
