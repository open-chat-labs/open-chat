use crate::client::user_index;
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use event_store_canister::{Milliseconds, TimestampMillis};
use pocket_ic::PocketIc;
use std::collections::HashMap;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{
    AccessGate, AccessGateConfig, AccessGateNonComposite, ChannelId, ChatId, CommunityId, CompositeGate,
    DiamondMembershipPlanDuration, OptionUpdate, TokenBalanceGate, UserId,
};

const DAY_IN_MS: Milliseconds = 24 * 60 * 60 * 1000;

#[derive(Clone, Copy, Debug)]
enum ContainerType {
    Community,
    Channel,
    Group,
}

#[derive(Clone, Copy, Debug)]
enum Container {
    Community(CommunityId),
    Channel(CommunityId, ChannelId),
    Group(ChatId),
}

#[test_case(ContainerType::Community)]
#[test_case(ContainerType::Channel)]
#[test_case(ContainerType::Group)]
fn diamond_member_lapses_and_rejoins_successfully(container_type: ContainerType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let gate_config = AccessGateConfig {
        gate: AccessGate::DiamondMember,
        expiry: Some(15 * DAY_IN_MS),
    };

    let num_users = 1;

    // Create n diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join users to the container
    let TestData { owner, users, container } =
        init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, false);

    // Move the time forward so that the users' diamond membership expires + the gate expiry
    env.advance_time(Duration::from_millis(46 * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // Assert that user has lapsed
        assert!(has_user_lapsed(env, user, &container));

        // Buy Diamond again
        client::upgrade_user(
            user,
            env,
            canister_ids,
            *controller,
            DiamondMembershipPlanDuration::OneMonth,
            false,
        );

        // user rejoins channel
        join_container(env, &owner, user, canister_ids, &container, false);

        // Assert that user2 is no longer lapsed
        assert!(!has_user_lapsed(env, user, &container));
    }
}

#[test_case(ContainerType::Community)]
#[test_case(ContainerType::Channel)]
#[test_case(ContainerType::Group)]
fn remove_gate_unlapses_members(container_type: ContainerType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let gate_config = AccessGateConfig {
        gate: AccessGate::DiamondMember,
        expiry: Some(15 * DAY_IN_MS),
    };

    let num_users = 2;

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join users to the container
    let TestData { owner, users, container } =
        init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, false);

    // Move the time forward so that the users' diamond membership expires + the gate expiry
    let mut timestamp = now_millis(env);
    env.advance_time(Duration::from_millis(46 * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // Assert that users have lapsed
        assert!(has_user_lapsed(env, user, &container));
    }

    // Assert that users marked as lapsed in updates query
    if let Some(members_added_or_updated) = get_updated_members(env, owner.principal, &container, timestamp) {
        for user in users.iter() {
            assert!(members_added_or_updated.get(&user.user_id).copied().unwrap_or_default());
        }
    } else {
        panic!("Expected memebers to have been updated");
    }

    timestamp = now_millis(env);
    env.advance_time(Duration::from_millis(DAY_IN_MS));

    // Remove the gate
    update_container_gate(env, owner.principal, &container, None);

    for user in users.iter() {
        // Assert that users are no longer lapsed
        assert!(!has_user_lapsed(env, user, &container));
    }

    // Assert that users marked as unlapsed in updates query
    if let Some(members_added_or_updated) = get_updated_members(env, owner.principal, &container, timestamp) {
        for user in users.iter() {
            assert!(!members_added_or_updated.get(&user.user_id).unwrap());
        }
    } else {
        panic!("Expected members to have been updated");
    }
}

#[test_case(ContainerType::Community, true)]
#[test_case(ContainerType::Channel, true)]
#[test_case(ContainerType::Group, true)]
#[test_case(ContainerType::Community, false)]
#[test_case(ContainerType::Channel, false)]
#[test_case(ContainerType::Group, false)]
fn extend_or_reduce_expiry_then_member_lapses_when_expected(container_type: ContainerType, extend_expiry: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let min_balance = 900_000_000;

    let gate = AccessGate::TokenBalance(TokenBalanceGate {
        ledger_canister_id: canister_ids.icp_ledger,
        min_balance,
    });

    let gate_config = AccessGateConfig {
        gate: gate.clone(),
        expiry: Some(4 * DAY_IN_MS),
    };

    let num_users = 2;

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join users to the container
    let TestData { owner, users, container } =
        init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, false);

    for user in users.iter() {
        // Users upgrade to 1 year diamond to reduce their token balance so they are set to lapse
        //
        user_index::happy_path::pay_for_diamond_membership(
            env,
            user.principal,
            canister_ids.user_index,
            DiamondMembershipPlanDuration::OneYear,
            false,
            false,
        );
    }

    tick_many(env, 4);

    // Either extend or reduce the expiry
    //
    let expiry = if extend_expiry { Some(6 * DAY_IN_MS) } else { Some(2 * DAY_IN_MS) };

    update_container_gate(
        env,
        owner.principal,
        &container,
        Some(AccessGateConfig {
            gate: gate.clone(),
            expiry,
        }),
    );

    // Move the time forward so the members should not lapse
    let duration = if extend_expiry { 5 } else { 1 };

    env.advance_time(Duration::from_millis(duration * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // Assert that the members have *not* lapsed
        assert!(!has_user_lapsed(env, user, &container));
    }

    // Move the time forward so the member should now lapse
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // Assert that the members have now lapsed
        assert!(has_user_lapsed(env, user, &container));
    }
}

#[test_case(ContainerType::Community)]
#[test_case(ContainerType::Channel)]
#[test_case(ContainerType::Group)]
fn member_lapses_from_token_balance_gate_and_rejoins_successfully(container_type: ContainerType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let min_balance = 900_000_000;
    let gate_config = AccessGateConfig {
        gate: AccessGate::TokenBalance(TokenBalanceGate {
            ledger_canister_id: canister_ids.icp_ledger,
            min_balance,
        }),
        expiry: Some(DAY_IN_MS),
    };

    let num_users = 2;

    // Create n diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join users to the container
    let TestData { owner, users, container } =
        init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, false);

    // Move the time forward so that the gate expires
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // User should have sufficient balance so should not be lapsed
        assert!(!has_user_lapsed(env, user, &container));

        // User upgrades to 1 year diamond to reduce their token balance
        user_index::happy_path::pay_for_diamond_membership(
            env,
            user.principal,
            canister_ids.user_index,
            DiamondMembershipPlanDuration::OneYear,
            false,
            false,
        );
    }

    tick_many(env, 4);

    // Move the time forward so that the gate expires
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    for user in users.iter() {
        // Assert that user2 has lapsed
        assert!(has_user_lapsed(env, user, &container));

        // Increase token balance
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.user_id, min_balance);

        // User2 rejoins channel
        join_container(env, &owner, user, canister_ids, &container, false);

        // Assert that user2 is no longer lapsed
        assert!(!has_user_lapsed(env, user, &container));
    }
}

#[test_case(ContainerType::Community)]
#[test_case(ContainerType::Channel)]
#[test_case(ContainerType::Group)]
fn gate_changes_and_members_lapse_as_expected(container_type: ContainerType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let gate_config = AccessGateConfig {
        gate: AccessGate::DiamondMember,
        expiry: Some(3 * DAY_IN_MS),
    };

    let num_users = 2;

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join users to the container
    let TestData { owner, users, container } =
        init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, false);

    let user1 = &users[0];
    let user2 = &users[1];

    // Move the time forward 1 day
    env.advance_time(Duration::from_millis(DAY_IN_MS));
    tick_many(env, 5);

    // A 3rd user now joins the channel
    let user3 = &register_and_join(env, canister_ids, *controller, &owner, &container, false);

    // Change container to have payment gate expiring in 3 days
    update_container_gate(
        env,
        owner.principal,
        &container,
        Some(AccessGateConfig {
            gate: AccessGate::TokenBalance(TokenBalanceGate {
                ledger_canister_id: canister_ids.icp_ledger,
                min_balance: 900_000_000,
            }),
            expiry: Some(3 * DAY_IN_MS),
        }),
    );

    // user2, user3 spend money so not enough for payment gate
    //
    user_index::happy_path::pay_for_diamond_membership(
        env,
        user2.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneYear,
        false,
        false,
    );
    user_index::happy_path::pay_for_diamond_membership(
        env,
        user3.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneYear,
        false,
        false,
    );

    // Move the time forward 2.1 days
    env.advance_time(Duration::from_millis((21 * DAY_IN_MS) / 10));
    tick_many(env, 5);

    // Only user2 should be lapsed
    assert!(!has_user_lapsed(env, user1, &container));
    assert!(has_user_lapsed(env, user2, &container));
    assert!(!has_user_lapsed(env, user3, &container));

    // Change to payment gate expires in 4 days
    update_container_gate(
        env,
        owner.principal,
        &container,
        Some(AccessGateConfig {
            gate: AccessGate::TokenBalance(TokenBalanceGate {
                ledger_canister_id: canister_ids.icp_ledger,
                min_balance: 900_000_000,
            }),
            expiry: Some(4 * DAY_IN_MS),
        }),
    );

    // Move the time forward 1 day
    env.advance_time(Duration::from_millis(DAY_IN_MS));
    tick_many(env, 5);

    // User 3 still not lapsed
    assert!(!has_user_lapsed(env, user1, &container));
    assert!(has_user_lapsed(env, user2, &container));
    assert!(!has_user_lapsed(env, user3, &container));

    // Move the time forward 1 day
    env.advance_time(Duration::from_millis(DAY_IN_MS));
    tick_many(env, 5);

    // User 3 now lapsed
    assert!(!has_user_lapsed(env, user1, &container));
    assert!(has_user_lapsed(env, user2, &container));
    assert!(has_user_lapsed(env, user3, &container));
}

#[test_case(ContainerType::Community)]
#[test_case(ContainerType::Channel)]
#[test_case(ContainerType::Group)]
fn invited_users_pass_composite_gate_then_expire_later(container_type: ContainerType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    // Create a composite gate
    let gate_config = AccessGateConfig {
        gate: AccessGate::Composite(CompositeGate {
            inner: vec![
                AccessGateNonComposite::DiamondMember,
                AccessGateNonComposite::TokenBalance(TokenBalanceGate {
                    ledger_canister_id: canister_ids.icp_ledger,
                    min_balance: 1_000_000_000,
                }),
            ],
            and: true,
        }),
        expiry: Some(DAY_IN_MS),
    };

    let num_users = 2;

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and invite + join users to the container
    let TestData {
        owner: _,
        users,
        container,
    } = init_test_data(env, canister_ids, *controller, gate_config, num_users, container_type, true);

    let user1 = &users[0];
    let user2 = &users[1];

    // Transfer more funds to user1 so they will pass the expiring gate check
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 200_000_000);

    // Move the time forward so that the gate expires
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    assert!(!has_user_lapsed(env, user1, &container));
    assert!(has_user_lapsed(env, user2, &container));
}

fn has_user_lapsed(env: &mut PocketIc, user: &User, container: &Container) -> bool {
    match container {
        Container::Community(community_id) => {
            let summary = client::community::happy_path::summary(env, user.principal, *community_id);
            summary.membership.map_or(false, |m| m.lapsed)
        }
        Container::Channel(community_id, channel_id) => {
            let summary = client::community::happy_path::channel_summary(env, user, *community_id, *channel_id);
            summary.membership.map_or(false, |m| m.lapsed)
        }
        Container::Group(group_id) => {
            let summary = client::group::happy_path::summary(env, user.principal, *group_id);
            summary.membership.map_or(false, |m| m.lapsed)
        }
    }
}

fn join_container(
    env: &mut PocketIc,
    owner: &User,
    user: &User,
    canister_ids: &CanisterIds,
    container: &Container,
    invite: bool,
) {
    match container {
        Container::Community(community_id) => {
            if invite {
                client::local_user_index::happy_path::invite_users_to_community(
                    env,
                    owner,
                    canister_ids.local_user_index(env, *community_id),
                    *community_id,
                    vec![user.user_id],
                );
            }

            client::community::happy_path::join_community(env, user.principal, *community_id);
        }
        Container::Channel(community_id, channel_id) => {
            if invite {
                client::local_user_index::happy_path::invite_users_to_community(
                    env,
                    owner,
                    canister_ids.local_user_index(env, *community_id),
                    *community_id,
                    vec![user.user_id],
                );

                client::community::happy_path::join_community(env, user.principal, *community_id);
            }

            if invite {
                client::local_user_index::happy_path::invite_users_to_channel(
                    env,
                    owner,
                    canister_ids.local_user_index(env, *community_id),
                    *community_id,
                    *channel_id,
                    vec![user.user_id],
                );
            }

            client::community::happy_path::join_channel(env, user.principal, *community_id, *channel_id);
        }
        Container::Group(group_id) => {
            if invite {
                client::local_user_index::happy_path::invite_users_to_group(
                    env,
                    owner,
                    canister_ids.local_user_index(env, *group_id),
                    *group_id,
                    vec![user.user_id],
                );
            }

            client::group::happy_path::join_group(env, user.principal, *group_id);
        }
    }
}

fn update_container_gate(
    env: &mut PocketIc,
    principal: Principal,
    container: &Container,
    gate_config: Option<AccessGateConfig>,
) {
    let gate_config_update = match gate_config {
        Some(gc) => OptionUpdate::SetToSome(gc),
        None => OptionUpdate::SetToNone,
    };

    match container {
        Container::Community(community_id) => {
            let args = community_canister::update_community::Args {
                name: None,
                description: None,
                rules: None,
                avatar: OptionUpdate::NoChange,
                banner: OptionUpdate::NoChange,
                permissions: None,
                gate_config: gate_config_update,
                public: None,
                primary_language: None,
            };

            client::community::happy_path::update_community(env, principal, *community_id, &args);
        }
        Container::Channel(community_id, channel_id) => {
            let args = community_canister::update_channel::Args {
                channel_id: *channel_id,
                name: None,
                description: None,
                rules: None,
                avatar: OptionUpdate::NoChange,
                permissions_v2: None,
                events_ttl: OptionUpdate::NoChange,
                gate_config: gate_config_update,
                public: None,
                messages_visible_to_non_members: None,
                external_url: OptionUpdate::NoChange,
            };

            client::community::happy_path::update_channel(env, principal, *community_id, &args);
        }
        Container::Group(group_id) => {
            let args = group_canister::update_group_v2::Args {
                name: None,
                description: None,
                rules: None,
                avatar: OptionUpdate::NoChange,
                gate_config: gate_config_update,
                public: None,
                permissions_v2: None,
                events_ttl: OptionUpdate::NoChange,
                messages_visible_to_non_members: None,
                correlation_id: 0,
            };

            client::group::happy_path::update_group(env, principal, *group_id, &args);
        }
    }
}

fn register_and_join(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    owner: &User,
    container: &Container,
    invite: bool,
) -> User {
    let user = client::register_user(env, canister_ids);

    // Upgrade users to non-recurring diamond membership
    client::upgrade_user(
        &user,
        env,
        canister_ids,
        controller,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );

    // Join the "container"
    join_container(env, owner, &user, canister_ids, container, invite);

    user
}

fn get_updated_members(
    env: &mut PocketIc,
    sender: Principal,
    container: &Container,
    updates_since: TimestampMillis,
) -> Option<HashMap<UserId, bool>> {
    match container {
        Container::Community(community_id) => {
            let results = client::community::happy_path::selected_updates(env, sender, *community_id, updates_since);
            results.map(|result| {
                result
                    .members_added_or_updated
                    .iter()
                    .map(|m| (m.user_id, m.lapsed))
                    .collect()
            })
        }
        Container::Channel(community_id, channel_id) => {
            let results =
                client::community::happy_path::selected_channel_updates(env, sender, *community_id, *channel_id, updates_since);
            results.map(|result| {
                result
                    .members_added_or_updated
                    .iter()
                    .map(|m| (m.user_id, m.lapsed))
                    .collect()
            })
        }
        Container::Group(group_id) => {
            let results = client::group::happy_path::selected_updates(env, sender, *group_id, updates_since);
            results.map(|result| {
                result
                    .members_added_or_updated
                    .iter()
                    .map(|m| (m.user_id, m.lapsed))
                    .collect()
            })
        }
    }
}

fn init_test_data(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    gate_config: AccessGateConfig,
    num_users: usize,
    container_type: ContainerType,
    invite: bool,
) -> TestData {
    let owner = client::register_diamond_user(env, canister_ids, controller);

    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);

    let container = match container_type {
        ContainerType::Community => Container::Community(community_id),
        ContainerType::Channel => Container::Channel(community_id, channel_id),
        ContainerType::Group => Container::Group(group_id),
    };

    // Update the container's access gate
    update_container_gate(env, owner.principal, &container, Some(gate_config));

    let mut users = Vec::new();

    for _i in 0..num_users {
        let user = register_and_join(env, canister_ids, controller, &owner, &container, invite);
        users.push(user);
    }

    TestData { owner, users, container }
}

struct TestData {
    owner: User,
    users: Vec<User>,
    container: Container,
}
