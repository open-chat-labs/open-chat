use crate::client::user_index;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use event_store_canister::Milliseconds;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{
    AccessGate, AccessGateConfig, ChannelId, ChatId, CommunityId, DiamondMembershipPlanDuration, OptionUpdate, TokenBalanceGate,
};

const DAY_IN_MS: Milliseconds = 24 * 60 * 60 * 1000;

#[derive(Clone, Copy, Debug)]
enum Container {
    Community,
    Channel,
    Group,
}

#[test_case(Container::Community)]
#[test_case(Container::Channel)]
#[test_case(Container::Group)]
fn diamond_member_lapses_and_rejoins_successfully(container: Container) {
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

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join iuser 2 to the container
    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
        group_id,
    } = init_test_data(env, canister_ids, *controller, gate_config, container);

    // Move the time forward so that user2's diamond membership expires + the gate expiry
    env.advance_time(Duration::from_millis(46 * DAY_IN_MS));
    tick_many(env, 10);

    // Assert that user2 has lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, true);

    // Buy Diamond again
    client::upgrade_user(
        &user2,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );

    // User2 rejoins channel
    join_container(
        env,
        user2.principal,
        canister_ids,
        community_id,
        channel_id,
        group_id,
        container,
    );

    // Assert that user2 is no longer lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, false);
}

#[test_case(Container::Community)]
#[test_case(Container::Channel)]
#[test_case(Container::Group)]
fn remove_gate_unlapses_members(container: Container) {
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

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join iuser 2 to the container
    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
        group_id,
    } = init_test_data(env, canister_ids, *controller, gate_config, container);

    // Move the time forward so that user2's diamond membership expires + the gate expiry
    env.advance_time(Duration::from_millis(46 * DAY_IN_MS));
    tick_many(env, 10);

    // Assert that user2 has lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, true);

    // Remove the gate
    update_container_gate(env, user1.principal, community_id, channel_id, group_id, container, None);

    // Assert that user2 is no longer lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, false);
}

#[test_case(Container::Community, true)]
#[test_case(Container::Channel, true)]
#[test_case(Container::Group, true)]
#[test_case(Container::Community, false)]
#[test_case(Container::Channel, false)]
#[test_case(Container::Group, false)]
fn extend_or_reduce_expiry_then_member_lapses_when_expected(container: Container, extend_expiry: bool) {
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

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join iuser 2 to the container
    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
        group_id,
    } = init_test_data(env, canister_ids, *controller, gate_config, container);

    // User2 upgrades to 1 year diamond to reduce their token balance so they are set to lapse
    //
    user_index::happy_path::pay_for_diamond_membership(
        env,
        user2.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneYear,
        false,
        false,
    );

    tick_many(env, 4);

    // Either extend or reduce the expiry
    //
    let expiry = if extend_expiry { Some(6 * DAY_IN_MS) } else { Some(2 * DAY_IN_MS) };

    update_container_gate(
        env,
        user1.principal,
        community_id,
        channel_id,
        group_id,
        container,
        Some(AccessGateConfig {
            gate: gate.clone(),
            expiry,
        }),
    );

    // Move the time forward so the member should not lapse
    let duration = if extend_expiry { 5 } else { 1 };

    env.advance_time(Duration::from_millis(duration * DAY_IN_MS));
    tick_many(env, 10);

    // Assert that user2 has *not* lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, false);

    // Move the time forward so the member should now lapse
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 10);

    // Assert that user2 has lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, true);
}

#[test_case(Container::Community)]
#[test_case(Container::Channel)]
#[test_case(Container::Group)]
fn member_lapses_from_token_balance_gate_and_rejoins_successfully(container: Container) {
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

    // Create 2 diamond users, a public community with a public channel, and a public group
    // Update the container with the access gate and join iuser 2 to the container
    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
        group_id,
    } = init_test_data(env, canister_ids, *controller, gate_config, container);

    // Move the time forward so that the gate expires
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    // User2 should have sufficient balance so should not be lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, false);

    // User2 upgrades to 1 year diamond to reduce their token balance
    user_index::happy_path::pay_for_diamond_membership(
        env,
        user2.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneYear,
        false,
        false,
    );

    tick_many(env, 4);

    // Move the time forward so that the gate expires
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 5);

    // Assert that user2 has lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, true);

    // Increase token balance
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.user_id, min_balance);

    // User2 rejoins channel
    join_container(
        env,
        user2.principal,
        canister_ids,
        community_id,
        channel_id,
        group_id,
        container,
    );

    // Assert that user2 is no longer lapsed
    assert_user_lapsed(env, container, &user2, community_id, channel_id, group_id, false);
}

fn assert_user_lapsed(
    env: &mut PocketIc,
    container: Container,
    user: &User,
    community_id: CommunityId,
    channel_id: ChannelId,
    group_id: ChatId,
    lapsed: bool,
) {
    match container {
        Container::Community => {
            let summary = client::community::happy_path::summary(env, user, community_id);
            assert!(summary.membership.map_or(false, |m| m.lapsed == lapsed));
        }
        Container::Channel => {
            let summary = client::community::happy_path::channel_summary(env, user, community_id, channel_id);
            assert!(summary.membership.map_or(false, |m| m.lapsed == lapsed));
        }
        Container::Group => {
            let summary = client::group::happy_path::summary(env, user, group_id);
            assert!(summary.membership.map_or(false, |m| m.lapsed == lapsed));
        }
    }
}

fn join_container(
    env: &mut PocketIc,
    principal: Principal,
    canister_ids: &CanisterIds,
    community_id: CommunityId,
    channel_id: ChannelId,
    group_id: ChatId,
    container: Container,
) {
    match container {
        Container::Community | Container::Channel => {
            client::local_user_index::happy_path::join_channel(
                env,
                principal,
                canister_ids.local_user_index,
                community_id,
                channel_id,
            );
        }
        Container::Group => {
            client::local_user_index::happy_path::join_group(
                //
                env,
                principal,
                canister_ids.local_user_index,
                group_id,
            );
        }
    }
}

fn update_container_gate(
    env: &mut PocketIc,
    principal: Principal,
    community_id: CommunityId,
    channel_id: ChannelId,
    group_id: ChatId,
    container: Container,
    gate_config: Option<AccessGateConfig>,
) {
    let gate_config_update = match gate_config {
        Some(gc) => OptionUpdate::SetToSome(gc),
        None => OptionUpdate::SetToNone,
    };

    match container {
        Container::Community => update_community_gate(env, principal, community_id, gate_config_update),
        Container::Channel => update_channel_gate(env, principal, community_id, channel_id, gate_config_update),
        Container::Group => update_group_gate(env, principal, group_id, gate_config_update),
    }
}

fn update_community_gate(
    env: &mut PocketIc,
    principal: Principal,
    community_id: CommunityId,
    gate_config_update: OptionUpdate<AccessGateConfig>,
) {
    let args = community_canister::update_community::Args {
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        banner: OptionUpdate::NoChange,
        permissions: None,
        gate: OptionUpdate::NoChange,
        gate_config: gate_config_update,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, principal, community_id, &args);
}

fn update_channel_gate(
    env: &mut PocketIc,
    principal: Principal,
    community_id: CommunityId,
    channel_id: ChannelId,
    gate_config_update: OptionUpdate<AccessGateConfig>,
) {
    let args = community_canister::update_channel::Args {
        channel_id,
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        permissions_v2: None,
        events_ttl: OptionUpdate::NoChange,
        gate: OptionUpdate::NoChange,
        gate_config: gate_config_update,
        public: None,
        messages_visible_to_non_members: None,
        external_url: OptionUpdate::NoChange,
    };

    client::community::happy_path::update_channel(env, principal, community_id, &args);
}

fn update_group_gate(
    env: &mut PocketIc,
    principal: Principal,
    group_id: ChatId,
    gate_config_update: OptionUpdate<AccessGateConfig>,
) {
    let args = group_canister::update_group_v2::Args {
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        gate: OptionUpdate::NoChange,
        gate_config: gate_config_update,
        public: None,
        permissions_v2: None,
        events_ttl: OptionUpdate::NoChange,
        messages_visible_to_non_members: None,
        correlation_id: 0,
    };

    client::group::happy_path::update_group(env, principal, group_id, &args);
}

fn init_test_data(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    gate_config: AccessGateConfig,
    container: Container,
) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    // Upgrade user 2 to non-recurring diamond membership
    client::upgrade_user(
        &user2,
        env,
        canister_ids,
        controller,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);

    // Update the container's access gate
    update_container_gate(
        env,
        user1.principal,
        community_id,
        channel_id,
        group_id,
        container,
        Some(gate_config),
    );

    // User 2 joins the "container"
    join_container(
        env,
        user2.principal,
        canister_ids,
        community_id,
        channel_id,
        group_id,
        container,
    );

    TestData {
        user1,
        user2,
        community_id,
        channel_id,
        group_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
    group_id: ChatId,
}
