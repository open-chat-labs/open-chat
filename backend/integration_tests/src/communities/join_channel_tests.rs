use crate::communities::join_community_tests::wait_for_invitation;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::{Nat, Principal};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CanisterId, ChannelId, CommunityId};

#[test]
fn join_public_channel_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    // First user2 needs to leave the channel because they were joined automatically
    client::community::happy_path::leave_channel(env, user2.principal, community_id, channel_id);

    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));

    wait_for_channel_membership(env, &user2, community_id, channel_id);
}

// A community which has run out of cycles rejects the call to join it, so the LocalUserIndex tops
// it up and makes the call again
#[test]
fn join_channel_tops_up_community_which_is_out_of_cycles() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    // First user2 needs to leave the channel because they were joined automatically
    client::community::happy_path::leave_channel(env, user2.principal, community_id, channel_id);

    // A new community starts below the balance it keeps, so it asks for top ups as it handles its
    // first updates. Let those land, then move past the window in which the LocalUserIndex retries
    // a call without topping the canister up again.
    tick_many(env, 10);
    env.advance_time(Duration::from_secs(2 * 60));

    // Raise the freezing threshold until the cycles it reserves are just above the balance, which
    // freezes the community, leaving it short by far less than a top up
    let canister_id = CanisterId::from(community_id);
    let local_user_index = canister_ids.local_user_index(env, community_id);
    let balance = env.cycle_balance(canister_id);
    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    let original_freezing_threshold = status.settings.freezing_threshold.clone();
    let burned_per_day: u128 = status.idle_cycles_burned_per_day.0.try_into().unwrap();
    assert!(burned_per_day > 0);
    let freezing_threshold_secs = (balance + 50_000_000_000) * 24 * 60 * 60 / burned_per_day;
    set_freezing_threshold(env, canister_id, local_user_index, freezing_threshold_secs.into());

    // The payload doesn't matter, since a frozen canister rejects the call before decoding it
    let frozen = env
        .update_call(canister_id, user2.principal, "leave_channel_msgpack", Vec::new())
        .unwrap_err();
    assert!(frozen.reject_message.contains("out of cycles"), "{frozen:?}");

    // Via the LocalUserIndex found above, since finding it again would query the frozen community
    client::local_user_index::happy_path::join_channel(env, user2.principal, local_user_index, community_id, channel_id);

    // Less a margin for the cycles the join itself uses
    assert!(env.cycle_balance(canister_id) > balance + 150_000_000_000);

    wait_for_channel_membership(env, &user2, community_id, channel_id);

    // Put the freezing threshold back, since the environment, and so this canister, is shared with
    // later tests
    set_freezing_threshold(env, canister_id, local_user_index, original_freezing_threshold);
}

fn set_freezing_threshold(env: &PocketIc, canister_id: CanisterId, controller: CanisterId, freezing_threshold: Nat) {
    env.update_canister_settings(
        canister_id,
        Some(controller),
        pocket_ic::CanisterSettings {
            freezing_threshold: Some(freezing_threshold),
            ..Default::default()
        },
    )
    .unwrap();
}

#[test]
fn join_private_channel_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    let response = client::local_user_index::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
            referred_by: None,
            verified_credential_args: None,
            composite_gate_index: None,
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_channel::Response::Error(e) if e.matches_code(OCErrorCode::NotInvited)
    ));
}

#[test]
fn join_private_community_with_invitation_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![user2.user_id],
    );

    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    env.tick();

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));
}

#[test]
fn join_community_and_channel_in_single_call_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    let user3 = client::register_user(env, canister_ids);

    let response = client::local_user_index::join_channel(
        env,
        user3.principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
            referred_by: None,
            verified_credential_args: None,
            composite_gate_index: None,
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)
    ));
}

#[test]
fn invite_non_community_member_to_channel_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    let user3 = client::register_user(env, canister_ids);

    let invite_users_response = client::local_user_index::invite_users_to_channel(
        env,
        user1.principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::invite_users_to_channel::Args {
            community_id,
            channel_id,
            user_ids: vec![user3.user_id],
        },
    );

    assert!(matches!(
        invite_users_response,
        local_user_index_canister::invite_users_to_channel::Response::Success
    ));

    let join_channel_response = client::local_user_index::join_channel(
        env,
        user3.principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
            referred_by: None,
            verified_credential_args: None,
            composite_gate_index: None,
        },
    );

    assert!(matches!(
        join_channel_response,
        local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)
    ));
}

#[test]
fn invite_to_channel_oc_bot_message_received() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![user2.user_id],
    );

    wait_for_invitation(env, &user2, "channel", channel_id);
}

#[test]
fn channel_marked_as_read_after_joining() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    // First user2 needs to leave the channel because they were joined automatically
    client::community::happy_path::leave_channel(env, user2.principal, community_id, channel_id);

    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);

    let user3 = client::register_user(env, canister_ids);

    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);
    client::community::happy_path::join_channel(env, user3.principal, community_id, channel_id);

    let user2_channel = wait_for_channel_membership(env, &user2, community_id, channel_id);
    let user3_channel = wait_for_channel_membership(env, &user3, community_id, channel_id);

    assert_eq!(user2_channel.read_by_me_up_to, Some(2.into()));
    assert_eq!(user3_channel.read_by_me_up_to, Some(2.into()));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let community_name = random_string();
    let channel_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec!["abcde".to_string()]);

    client::community::happy_path::join_community(env, user2.principal, community_id);

    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, public, channel_name);

    env.tick();

    TestData {
        user1,
        user2,
        community_id,
        channel_id,
    }
}

// Ticks until the user's canister lists the channel, ie. the event telling it that the user joined
// the channel has been delivered, and returns the user's copy of it. That event adds the community too
// if the user was not yet in it, and marks the channel as read, so neither needs a wait of its own.
fn wait_for_channel_membership(
    env: &mut PocketIc,
    user: &User,
    community_id: CommunityId,
    channel_id: ChannelId,
) -> user_canister::ChannelSummary {
    for _ in 0..30 {
        let initial_state = client::user::happy_path::initial_state(env, user);
        if let Some(channel) = initial_state
            .communities
            .summaries
            .into_iter()
            .find(|c| c.community_id == community_id)
            .and_then(|c| c.channels.into_iter().find(|c| c.channel_id == channel_id))
        {
            return channel;
        }
        env.tick();
    }
    panic!("User {} was not notified of joining the channel", user.user_id);
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
