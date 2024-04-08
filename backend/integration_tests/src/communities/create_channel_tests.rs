use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use types::{AccessGate, CommunityId, Rules};

#[test_case(true)]
#[test_case(false)]
fn create_channel_succeeds(is_public: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user, community_id } = init_test_data(env, canister_ids, *controller, true);

    let channel_name = random_string();
    let channel_id =
        client::community::happy_path::create_channel(env, user.principal, community_id, is_public, channel_name.clone());

    let summary = client::community::happy_path::summary(env, &user, community_id);

    assert_eq!(summary.channels.len(), 2);
    assert!(summary
        .channels
        .iter()
        .any(|c| c.channel_id == channel_id && c.is_public == is_public && c.name == channel_name));
}

#[test_case(true)]
#[test_case(false)]
fn existing_users_joined_to_new_public_channel(diamond_gate: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user, community_id } = init_test_data(env, canister_ids, *controller, true);

    let user2 = client::register_diamond_user(env, canister_ids, *controller);
    let user3 = client::register_user(env, canister_ids);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);
    client::local_user_index::happy_path::join_community(env, user3.principal, canister_ids.local_user_index, community_id);

    let create_channel_response = client::community::create_channel(
        env,
        user.principal,
        community_id.into(),
        &community_canister::create_channel::Args {
            is_public: true,
            name: random_string(),
            description: random_string(),
            rules: Rules::default(),
            subtype: None,
            avatar: None,
            history_visible_to_new_joiners: true,
            permissions_v2: None,
            events_ttl: None,
            gate: diamond_gate.then_some(AccessGate::DiamondMember),
        },
    );

    let channel_id = if let community_canister::create_channel::Response::Success(result) = create_channel_response {
        result.channel_id
    } else {
        panic!()
    };

    let user2_summary = client::community::happy_path::summary(env, &user2, community_id);
    let user3_summary = client::community::happy_path::summary(env, &user3, community_id);

    assert!(user2_summary.channels.iter().any(|c| c.channel_id == channel_id));

    assert_eq!(
        user3_summary.channels.iter().any(|c| c.channel_id == channel_id),
        !diamond_gate
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);
    let community_name = random_string();
    let community_id = client::user::happy_path::create_community(env, &user, &community_name, public, vec![random_string()]);

    env.tick();

    TestData { user, community_id }
}

struct TestData {
    user: User,
    community_id: CommunityId,
}
