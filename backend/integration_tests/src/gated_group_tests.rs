use crate::env::ENV;
use crate::utils::{tick_many, try_metrics};
use crate::{TestEnv, User, client};
use candid::{Nat, Principal};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;
use icrc_ledger_types::icrc2::transfer_from::TransferFromError;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::RawMessageId;
use std::ops::Deref;
use std::time::Duration;
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
        member_spender_account(group_id.into(), &user2),
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

// A member approves the group or community to pull a gate's payment from their wallet, and it pulls
// the payment when they join, spending the approval made under the member's own spender
// subaccount, as for any other payment it pulls from a member's wallet. A user alone in their
// canister has it make the approval, from its account. A user in a MultiUser canister holds their
// own funds, in their principal's account, so the website makes the approval on the ledger itself.
#[test_case(Gated::Group, true; "group_multi_user")]
#[test_case(Gated::Community, true; "community_multi_user")]
#[test_case(Gated::Channel, true; "channel_multi_user")]
#[test_case(Gated::Group, false; "group_user_canister")]
#[test_case(Gated::Community, false; "community_user_canister")]
#[test_case(Gated::Channel, false; "channel_user_canister")]
fn member_pays_payment_gate_from_their_wallet(gated: Gated, in_multi_user_canister: bool) {
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
    let spender_account = member_spender_account(spender, &user);

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
// made under another member's is never spent. Nor is one made to the group's default account, since
// whoever called the group could spend it.
#[test_case(true; "approved for another member")]
#[test_case(false; "approved without a spender subaccount")]
fn payment_gate_is_only_paid_with_an_approval_under_the_members_spender_subaccount(approved_for_another_member: bool) {
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
        if approved_for_another_member {
            member_spender_account(group, &bob)
        } else {
            Account {
                owner: group,
                subaccount: None,
            }
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
        member_spender_account(group_id.into(), &user2),
        initial_balance,
    );
    client::ledger::happy_path::approve(
        env,
        user2.user_id.canister_id(),
        canister_ids.chat_ledger,
        member_spender_account(group_id.into(), &user2),
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

// A payment gate's ledger can be any canister the owner names, so it may accept the gate's payment
// but then fail every transfer out of the group or community. Each payment out is then retried after a
// delay which doubles with each failure, up to an hour, rather than round after round. A rejected
// transfer calls for no retry, so is retried after an hour, and a stopped ledger after 10 seconds, so
// after 20 seconds for a 2nd failure.
#[test_case(Gated::Group)]
#[test_case(Gated::Community)]
fn gate_payment_failing_to_call_into_ledger_is_retried_with_backoff(gated: Gated) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let ledger = install_failing_ledger(env, *controller);
    let canister_id = create_gated_and_join(env, &owner, &user, &gated, ledger);

    let awaiting_retry = |env: &PocketIc| metric(env, canister_id, "payments_awaiting_retry");

    // Time doesn't pass as the rounds do, so however many there are, the payment to the owner (the
    // only one, the treasury's share being less than a fee) isn't retried
    tick_many(env, 20);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 1);
    assert_eq!(awaiting_retry(env), 1);

    // Retried an hour after the ledger rejected it
    env.advance_time(Duration::from_millis(HOUR_IN_MS - MINUTE_IN_MS));
    tick_many(env, 10);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 1);

    // By when the ledger is stopped, so the payment is retried 20 seconds later
    client::stop_canister(env, *controller, ledger);
    env.advance_time(Duration::from_millis(2 * MINUTE_IN_MS));
    tick_many(env, 10);
    client::start_canister(env, *controller, ledger);
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 10);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 1);
    env.advance_time(Duration::from_secs(10));
    tick_many(env, 10);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 2);

    // Rejected again, so retried an hour later, by when the ledger accepts the transfer
    env.update_call(ledger, *controller, "set_succeeding", vec![1]).unwrap();
    env.advance_time(Duration::from_millis(HOUR_IN_MS));
    tick_many(env, 10);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 3);
    assert_eq!(awaiting_retry(env), 0);
    assert_eq!(metric(env, canister_id, "parked_payments"), 0);
}

// A ledger which has been deleted won't come back, and one which has been uninstalled has lost its
// balances, so a payment from either is parked, being kept but not retried
#[test_case(Gated::Group)]
#[test_case(Gated::Community)]
fn gate_payment_from_uninstalled_ledger_is_parked(gated: Gated) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let ledger = install_failing_ledger(env, *controller);
    let canister_id = create_gated_and_join(env, &owner, &user, &gated, ledger);

    tick_many(env, 20);
    assert_eq!(failing_ledger_transfer_calls(env, ledger), 1);
    env.uninstall_canister(ledger, Some(*controller)).unwrap();

    // The retry an hour later finds the ledger uninstalled, so parks the payment
    env.advance_time(Duration::from_millis(HOUR_IN_MS + MINUTE_IN_MS));
    tick_many(env, 10);
    assert_eq!(metric(env, canister_id, "parked_payments"), 1);
    assert_eq!(metric(env, canister_id, "payments_awaiting_retry"), 0);

    // Which is never retried
    env.advance_time(Duration::from_millis(2 * HOUR_IN_MS));
    tick_many(env, 10);
    assert_eq!(metric(env, canister_id, "parked_payments"), 1);
    assert_eq!(metric(env, canister_id, "payments_awaiting_retry"), 0);
}

// Two members joining make two equal payments to the owner. If both have to be retried, and the
// retries fall due in the same round, they are still made as distinct transfers, rather than the
// ledger rejecting the second as a duplicate of the first, which would leave the owner paid once.
#[test_case(Gated::Group)]
#[test_case(Gated::Community)]
fn equal_gate_payments_retried_in_the_same_round_are_both_made(gated: Gated) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let ledger = canister_ids.icp_ledger;
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let amount = 1_000_000;
    let fee = 10_000;
    let (canister_id, _) = create_gated(env, &owner, &gated, ledger, amount, fee);
    let owner_balance = client::ledger::happy_path::balance_of(env, ledger, owner.user_id);

    // Each member's payment is taken while the ledger is running, but the ledger is stopped before
    // the owner is paid, so the payment to the owner is retried 10 seconds later. Time doesn't pass
    // as the rounds do, so both retries fall due at the same time.
    for _ in 0..2 {
        let user = client::register_user(env, canister_ids);
        client::ledger::happy_path::transfer(env, *controller, ledger, user.user_id, amount);
        client::user::happy_path::approve_transfer(
            env,
            &user,
            &user_canister::approve_transfer::Args {
                spender: member_spender_account(canister_id, &user).into(),
                ledger_canister_id: ledger,
                amount: amount - fee,
                expires_in: None,
                pin: None,
            },
        );

        let balance = client::ledger::happy_path::balance_of(env, ledger, user.user_id);

        let message_id = submit_join(env, &user, &gated, canister_id);
        let charged = (0..50).any(|_| {
            env.tick();
            client::ledger::happy_path::balance_of(env, ledger, user.user_id) < balance
        });
        assert!(charged);
        client::stop_canister(env, *controller, ledger);
        env.await_call(message_id).unwrap();
        tick_many(env, 10);
        client::start_canister(env, *controller, ledger);
    }
    assert_eq!(metric(env, canister_id, "payments_awaiting_retry"), 2);

    env.advance_time(Duration::from_secs(11));
    tick_many(env, 10);
    assert_eq!(
        client::ledger::happy_path::balance_of(env, ledger, owner.user_id) - owner_balance,
        2 * 970_000
    );
    assert_eq!(metric(env, canister_id, "payments_awaiting_retry"), 0);
}

// Submits `user`'s request to join the group or community without waiting for it to complete
fn submit_join(env: &PocketIc, user: &User, gated: &Gated, canister_id: Principal) -> RawMessageId {
    let (local_user_index, method, args) = match gated {
        Gated::Group => (
            client::group::happy_path::local_user_index(env, canister_id.into()),
            "join_group_msgpack",
            msgpack::serialize_then_unwrap(&local_user_index_canister::join_group::Args {
                chat_id: canister_id.into(),
                invite_code: None,
                verified_credential_args: None,
                composite_gate_index: None,
            }),
        ),
        Gated::Community => (
            client::community::happy_path::local_user_index(env, canister_id.into()),
            "join_community_msgpack",
            msgpack::serialize_then_unwrap(&local_user_index_canister::join_community::Args {
                community_id: canister_id.into(),
                invite_code: None,
                referred_by: None,
                verified_credential_args: None,
                composite_gate_index: None,
            }),
        ),
        Gated::Channel => unreachable!(),
    };
    env.submit_call(local_user_index, user.principal, method, args).unwrap()
}

// Creates a group or community with a payment gate on `ledger`, which `user` joins, returning the
// group or community
fn create_gated_and_join(env: &mut PocketIc, owner: &User, user: &User, gated: &Gated, ledger: CanisterId) -> Principal {
    // The owner's share is all that's left after the fees, so the treasury isn't paid
    let (canister_id, _) = create_gated(env, owner, gated, ledger, 1_000_000, 10_000);
    match gated {
        Gated::Group => client::group::happy_path::join_group(env, user.principal, canister_id.into()),
        Gated::Community => {
            client::community::happy_path::join_community(env, user.principal, canister_id.into());
        }
        Gated::Channel => unreachable!(),
    }
    canister_id
}

// Installs a ledger which accepts any `icrc2_transfer_from`, so that a gate's payment is taken, but
// rejects every `icrc1_transfer` until `set_succeeding` is called with a 1, counting each call
fn install_failing_ledger(env: &mut PocketIc, controller: Principal) -> CanisterId {
    const REJECT_MESSAGE: &str = "Transfer rejected";

    let transfer_from_ok = candid::encode_one(Result::<Nat, TransferFromError>::Ok(Nat::from(0u32))).unwrap();
    let transfer_ok = candid::encode_one(Result::<Nat, TransferError>::Ok(Nat::from(0u32))).unwrap();
    let escape = |bytes: &[u8]| bytes.iter().map(|b| format!("\\{b:02x}")).collect::<String>();

    let wat = format!(
        r#"
(module
  (import "ic0" "msg_arg_data_copy" (func $msg_arg_data_copy (param i32 i32 i32)))
  (import "ic0" "msg_reply_data_append" (func $msg_reply_data_append (param i32 i32)))
  (import "ic0" "msg_reply" (func $msg_reply))
  (import "ic0" "msg_reject" (func $msg_reject (param i32 i32)))
  (memory 1)
  ;; The number of calls to `icrc1_transfer` is kept at 0, and whether they succeed at 4
  (data (i32.const 1000) "{transfer_from_ok}")
  (data (i32.const 2000) "{transfer_ok}")
  (data (i32.const 3000) "{REJECT_MESSAGE}")
  (func $transfer_from
    (call $msg_reply_data_append (i32.const 1000) (i32.const {transfer_from_ok_len}))
    (call $msg_reply))
  (func $transfer
    (i32.store (i32.const 0) (i32.add (i32.load (i32.const 0)) (i32.const 1)))
    (if (i32.load8_u (i32.const 4))
      (then
        (call $msg_reply_data_append (i32.const 2000) (i32.const {transfer_ok_len}))
        (call $msg_reply))
      (else
        (call $msg_reject (i32.const 3000) (i32.const {reject_message_len})))))
  (func $set_succeeding
    (call $msg_arg_data_copy (i32.const 4) (i32.const 0) (i32.const 1))
    (call $msg_reply))
  (func $transfer_calls
    (call $msg_reply_data_append (i32.const 0) (i32.const 4))
    (call $msg_reply))
  (export "canister_update icrc2_transfer_from" (func $transfer_from))
  (export "canister_update icrc1_transfer" (func $transfer))
  (export "canister_update set_succeeding" (func $set_succeeding))
  (export "canister_query transfer_calls" (func $transfer_calls)))
"#,
        transfer_from_ok = escape(&transfer_from_ok),
        transfer_from_ok_len = transfer_from_ok.len(),
        transfer_ok = escape(&transfer_ok),
        transfer_ok_len = transfer_ok.len(),
        reject_message_len = REJECT_MESSAGE.len(),
    );

    let canister_id = client::create_canister(env, controller);
    env.install_canister(canister_id, wat::parse_str(wat).unwrap(), vec![], Some(controller));
    canister_id
}

fn failing_ledger_transfer_calls(env: &PocketIc, ledger: CanisterId) -> u32 {
    let bytes = env
        .query_call(ledger, Principal::anonymous(), "transfer_calls", Vec::new())
        .unwrap();
    u32::from_le_bytes(bytes.try_into().unwrap())
}

fn metric(env: &PocketIc, canister_id: Principal, name: &str) -> u64 {
    try_metrics(env, canister_id).unwrap()[name].as_u64().unwrap()
}

// The account a group or community pulls a member's gate payment as, which the member approves
fn member_spender_account(spender: Principal, member: &User) -> Account {
    Account {
        owner: spender,
        subaccount: Some(ledger_utils::spender_subaccount(member.principal)),
    }
}
