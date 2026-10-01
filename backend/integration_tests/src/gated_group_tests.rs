use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User, client};
use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{
    AccessGate, AccessGateNonComposite, CanisterId, ChannelId, CompositeGate, GateCheckFailedReason, PaymentGate, Rules,
    TokenBalanceGate,
};

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

enum Gated {
    Group,
    Community,
    Channel,
}

enum Approval {
    SpenderSubaccount,
    // TODO: Remove once the website approves the spender subaccount for gate payments, and the
    // fallback to the default account is removed
    DefaultAccount,
}

// A member approves the group or community to pull a gate's payment from their wallet, and it pulls
// the payment when they join, spending the approval made under the member's own spender
// subaccount, as for any other payment it pulls from a member's wallet. A user alone in their
// canister has it make the approval, from its account. A user in a MultiUser canister holds their
// own funds, in their principal's account, so the website makes the approval on the ledger itself.
// For now, an approval to the canister's default account, which websites made before the move to
// the spender subaccount, is spent if there isn't one under the spender subaccount.
#[test_case(Gated::Group, true, Approval::SpenderSubaccount; "group_multi_user")]
#[test_case(Gated::Community, true, Approval::SpenderSubaccount; "community_multi_user")]
#[test_case(Gated::Channel, true, Approval::SpenderSubaccount; "channel_multi_user")]
#[test_case(Gated::Group, false, Approval::SpenderSubaccount; "group_user_canister")]
#[test_case(Gated::Community, false, Approval::SpenderSubaccount; "community_user_canister")]
#[test_case(Gated::Channel, false, Approval::SpenderSubaccount; "channel_user_canister")]
#[test_case(Gated::Group, true, Approval::DefaultAccount; "group_multi_user_default_account")]
#[test_case(Gated::Community, false, Approval::DefaultAccount; "community_user_canister_default_account")]
#[test_case(Gated::Channel, true, Approval::DefaultAccount; "channel_multi_user_default_account")]
fn member_pays_payment_gate_from_their_wallet(gated: Gated, in_multi_user_canister: bool, approval: Approval) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = if in_multi_user_canister {
        client::register_user_in_multi_user_canister(env, canister_ids)
    } else {
        client::register_user(env, canister_ids)
    };
    let wallet = if in_multi_user_canister { user.principal } else { user.canister() };

    let amount = 1_0000_0000;
    let fee = 10_000;
    let (spender, channel_id) = create_gated(env, &owner, &gated, canister_ids.icp_ledger, amount, fee);
    let spender_account = Account {
        owner: spender,
        subaccount: match approval {
            Approval::SpenderSubaccount => Some(ledger_utils::spender_subaccount(user.principal)),
            Approval::DefaultAccount => None,
        },
    };

    let owner_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner.user_id);

    // The wallet holds the gate's amount, and approves the gate's amount less the approval's fee
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, wallet, amount);
    if in_multi_user_canister {
        client::ledger::happy_path::approve(env, wallet, canister_ids.icp_ledger, spender_account, amount - fee);
    } else {
        client::user::happy_path::approve_transfer(
            env,
            &user,
            &user_canister::approve_transfer::Args {
                spender: spender_account.into(),
                ledger_canister_id: canister_ids.icp_ledger,
                amount: amount - fee,
                expires_in: None,
                pin: None,
            },
        );
    }

    match gated {
        Gated::Group => client::group::happy_path::join_group(env, user.principal, spender.into()),
        Gated::Community => {
            client::community::happy_path::join_community(env, user.principal, spender.into());
        }
        Gated::Channel => {
            client::community::happy_path::join_community(env, user.principal, spender.into());
            client::community::happy_path::join_channel(env, user.principal, spender.into(), channel_id.unwrap());
        }
    }

    tick_many(env, 3);

    // The gate took exactly its amount from the wallet, of which the owner was paid their share
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet),
        0
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner.user_id) - owner_balance,
        (amount * 98) / 100
    );
}

// A member can only pay a gate with an approval made under their own spender subaccount, so one
// made under another member's is never spent
#[test]
fn payment_gate_is_not_paid_with_an_approval_under_another_members_spender_subaccount() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let alice = client::register_user_in_multi_user_canister(env, canister_ids);
    let bob = client::register_user_in_multi_user_canister(env, canister_ids);

    let amount = 1_0000_0000;
    let fee = 10_000;
    let (group, _) = create_gated(env, &owner, &Gated::Group, canister_ids.icp_ledger, amount, fee);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, alice.principal, amount);
    client::ledger::happy_path::approve(
        env,
        alice.principal,
        canister_ids.icp_ledger,
        Account {
            owner: group,
            subaccount: Some(ledger_utils::spender_subaccount(bob.principal)),
        },
        amount - fee,
    );

    let response = client::local_user_index::join_group(
        env,
        alice.principal,
        canister_ids.local_user_index(env, group),
        &local_user_index_canister::join_group::Args {
            chat_id: group.into(),
            invite_code: None,
            verified_credential_args: None,
            composite_gate_index: None,
        },
    );
    assert!(
        matches!(
            response,
            local_user_index_canister::join_group::Response::GateCheckFailed(GateCheckFailedReason::PaymentFailed(_))
        ),
        "{response:?}"
    );

    // Alice paid only for her approval
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, alice.principal),
        amount - fee
    );
}

// Creates a group, community or channel with a payment gate, returning the group or community, which
// pulls the payment, and the channel if it is a channel's gate
fn create_gated(
    env: &mut PocketIc,
    owner: &User,
    gated: &Gated,
    ledger_canister_id: CanisterId,
    amount: u128,
    fee: u128,
) -> (Principal, Option<ChannelId>) {
    let gate = AccessGate::Payment(PaymentGate {
        ledger_canister_id,
        amount,
        fee,
    });
    let name = random_string();

    match gated {
        Gated::Community => match client::user::create_community(
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
            user_canister::create_community::Response::Success(result) => (Principal::from(result.community_id), None),
            response => panic!("'create_community' error: {response:?}"),
        },
        Gated::Channel => {
            let community_id = client::user::happy_path::create_community(env, owner, &name, true, vec![random_string()]);
            let channel_id =
                client::community::happy_path::create_gated_channel(env, owner.principal, community_id, true, name, gate);
            (Principal::from(community_id), Some(channel_id))
        }
        Gated::Group => match client::user::create_group(
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
            user_canister::create_group::Response::Success(result) => (Principal::from(result.chat_id), None),
            response => panic!("'create_group' error: {response:?}"),
        },
    }
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
