use crate::env::ENV;
use crate::setup::install_sns_governance;
use crate::user_migration_tests::{migrate, platform_operator, wait_until_local_user_index_knows_of_migration};
use crate::utils::{tick_many, try_metrics};
use crate::{TestEnv, User, client};
use candid::Principal;
use constants::DAY_IN_MS;
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::RawMessageId;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_principal, random_string};
use types::{
    AccessGate, AccessGateConfig, AccessGateNonComposite, CanisterId, ChannelId, CompositeGate, GateCheckFailedReason,
    PaymentGate, Rules, SnsNeuronGate, TokenBalanceGate,
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
    let (spender, channel_id) = create_gated(env, &owner, &gated, payment_gate(canister_ids.icp_ledger, amount, fee));
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
    let (group, _) = create_gated(env, &owner, &Gated::Group, payment_gate(canister_ids.icp_ledger, amount, fee));

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

// The neurons a user has, as the hotkeys they list
#[derive(Clone, Copy)]
enum Neurons {
    // One listing their User canister, which they are still in
    UserCanister,
    // The rest are after they have been migrated to a MultiUser canister. One listing their principal.
    Principal,
    // One listing their old User canister
    OldUserCanister,
    // One listing someone else
    Neither,
    // Two, each with half the stake the gate requires, one listing their principal and the other their
    // old User canister
    SplitAcrossIds,
    // One with half the stake the gate requires, listing both their principal and their old User
    // canister, so counted only once
    SharedAcrossIds,
}

// A user in a MultiUser canister is told to add their principal as a hotkey on their neurons, since no
// one can add their user id. A migrated user's neurons may still list their old User canister, so
// neurons listing either count, both when they join and when the gate is checked again as it expires.
#[test_case(Gated::Group, Neurons::UserCanister; "group_user_canister")]
#[test_case(Gated::Group, Neurons::Principal; "group_principal")]
#[test_case(Gated::Group, Neurons::OldUserCanister; "group_old_user_canister")]
#[test_case(Gated::Group, Neurons::Neither; "group_neither")]
#[test_case(Gated::Group, Neurons::SplitAcrossIds; "group_split_across_ids")]
#[test_case(Gated::Group, Neurons::SharedAcrossIds; "group_shared_across_ids")]
#[test_case(Gated::Community, Neurons::Principal; "community_principal")]
#[test_case(Gated::Community, Neurons::OldUserCanister; "community_old_user_canister")]
#[test_case(Gated::Channel, Neurons::Principal; "channel_principal")]
#[test_case(Gated::Channel, Neurons::OldUserCanister; "channel_old_user_canister")]
fn sns_neuron_gate_counts_neurons_listing(gated: Gated, neurons: Neurons) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let migrated_user = (!matches!(neurons, Neurons::UserCanister)).then(|| {
        let operator = platform_operator(env, canister_ids, *controller);
        let multi_user_canister =
            client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids, user.local_user_index);
        migrate(env, canister_ids, &operator, &user, multi_user_canister)
    });
    let member = migrated_user.as_ref().unwrap_or(&user);

    let stake_e8s = 1_0000_0000;
    let half_stake_e8s = stake_e8s / 2;
    let neurons_hotkeys_and_stakes = match neurons {
        Neurons::UserCanister | Neurons::OldUserCanister => vec![(vec![user.canister()], stake_e8s)],
        Neurons::Principal => vec![(vec![user.principal], stake_e8s)],
        Neurons::Neither => vec![(vec![random_principal()], stake_e8s)],
        Neurons::SplitAcrossIds => vec![
            (vec![user.principal], half_stake_e8s),
            (vec![user.canister()], half_stake_e8s),
        ],
        Neurons::SharedAcrossIds => vec![(vec![user.principal, user.canister()], half_stake_e8s)],
    };
    let dissolve_delay = 30 * DAY_IN_MS;
    let governance_canister_id = install_sns_governance(env, *controller, neurons_hotkeys_and_stakes, dissolve_delay / 1000);

    let gate = AccessGate::SnsNeuron(SnsNeuronGate {
        governance_canister_id,
        min_stake_e8s: Some(stake_e8s),
        min_dissolve_delay: Some(dissolve_delay),
    });
    let gate_config = AccessGateConfig {
        gate,
        expiry: Some(DAY_IN_MS),
    };
    let (canister_id, channel_id) = create_gated(env, &owner, &gated, gate_config);

    // The group or community is told the user's old ids by its LocalUserIndex, once that knows of the
    // migration
    let local_user_index = canister_ids.local_user_index(env, canister_id);
    if let Some(migrated_user) = &migrated_user {
        wait_until_local_user_index_knows_of_migration(env, local_user_index, &user, migrated_user.user_id);
    }

    let result = match gated {
        Gated::Group => {
            match client::local_user_index::join_group(
                env,
                member.principal,
                local_user_index,
                &local_user_index_canister::join_group::Args {
                    chat_id: canister_id.into(),
                    invite_code: None,
                    verified_credential_args: None,
                    composite_gate_index: None,
                },
            ) {
                local_user_index_canister::join_group::Response::Success(_) => Ok(()),
                local_user_index_canister::join_group::Response::GateCheckFailed(reason) => Err(reason),
                response => panic!("'join_group' error: {response:?}"),
            }
        }
        Gated::Community => {
            match client::local_user_index::join_community(
                env,
                member.principal,
                local_user_index,
                &local_user_index_canister::join_community::Args {
                    community_id: canister_id.into(),
                    invite_code: None,
                    referred_by: None,
                    verified_credential_args: None,
                    composite_gate_index: None,
                },
            ) {
                local_user_index_canister::join_community::Response::Success(_) => Ok(()),
                local_user_index_canister::join_community::Response::GateCheckFailed(reason) => Err(reason),
                response => panic!("'join_community' error: {response:?}"),
            }
        }
        // The user isn't yet in the community, so joins it along with the channel
        Gated::Channel => {
            match client::local_user_index::join_channel(
                env,
                member.principal,
                local_user_index,
                &local_user_index_canister::join_channel::Args {
                    community_id: canister_id.into(),
                    channel_id: channel_id.unwrap(),
                    invite_code: None,
                    referred_by: None,
                    verified_credential_args: None,
                    composite_gate_index: None,
                },
            ) {
                local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_) => Ok(()),
                local_user_index_canister::join_channel::Response::GateCheckFailed(reason) => Err(reason),
                response => panic!("'join_channel' error: {response:?}"),
            }
        }
    };

    match neurons {
        Neurons::Neither => assert!(matches!(result, Err(GateCheckFailedReason::NoSnsNeuronsFound)), "{result:?}"),
        Neurons::SharedAcrossIds => assert!(
            matches!(result, Err(GateCheckFailedReason::NoSnsNeuronsWithRequiredStakeFound)),
            "{result:?}"
        ),
        _ => {
            assert!(result.is_ok(), "{result:?}");

            // Move the time forward so that the gate expires and is checked again, which takes a few
            // rounds, since the neurons are looked up in the SNS governance canister
            env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
            tick_many(env, 20);

            let lapsed = match gated {
                Gated::Group => client::group::happy_path::summary(env, member.principal, canister_id.into())
                    .membership
                    .map(|m| m.lapsed),
                Gated::Community => client::community::happy_path::summary(env, member.principal, canister_id.into())
                    .membership
                    .map(|m| m.lapsed),
                Gated::Channel => {
                    client::community::happy_path::channel_summary(env, member, canister_id.into(), channel_id.unwrap())
                        .membership
                        .map(|m| m.lapsed)
                }
            };
            assert_eq!(lapsed, Some(false));
        }
    }

    // The canister runs a heartbeat, which later tests drawing this env needn't pay for
    client::stop_canister(env, *controller, governance_canister_id);
}

fn payment_gate(ledger_canister_id: CanisterId, amount: u128, fee: u128) -> AccessGate {
    AccessGate::Payment(PaymentGate {
        ledger_canister_id,
        amount,
        fee,
    })
}

// Creates a group, community or channel with the gate, returning the group or community, which pulls
// any payment, and the channel if it is a channel's gate
fn create_gated(
    env: &mut PocketIc,
    owner: &User,
    gated: &Gated,
    gate_config: impl Into<AccessGateConfig>,
) -> (Principal, Option<ChannelId>) {
    let gate_config = gate_config.into();
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
                avatar: None,
                banner: None,
                history_visible_to_new_joiners: true,
                permissions: None,
                rules: Rules::default(),
                gate_config: Some(gate_config),
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
            let channel_id = client::community::happy_path::create_gated_channel(
                env,
                owner.principal,
                community_id,
                true,
                name,
                gate_config,
            );
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
                gate_config: Some(gate_config),
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

// Two members joining make two equal payments to the owner. If both have to be retried, and the
// retries fall due in the same round, they are still made as distinct transfers, rather than the
// ledger rejecting the second as a duplicate of the first, which would leave the owner paid once.
#[test]
fn equal_gate_payments_retried_in_the_same_round_are_both_made() {
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
    let (canister_id, _) = create_gated(env, &owner, &Gated::Group, payment_gate(ledger, amount, fee));
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

        let message_id = submit_join(env, &user, canister_id);
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

// Submits `user`'s request to join the group without waiting for it to complete
fn submit_join(env: &PocketIc, user: &User, group_id: Principal) -> RawMessageId {
    let args = msgpack::serialize_then_unwrap(&local_user_index_canister::join_group::Args {
        chat_id: group_id.into(),
        invite_code: None,
        verified_credential_args: None,
        composite_gate_index: None,
    });
    let local_user_index = client::group::happy_path::local_user_index(env, group_id.into());
    env.submit_call(local_user_index, user.principal, "join_group_msgpack", args)
        .unwrap()
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
