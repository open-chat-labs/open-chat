use crate::env::ENV;
use crate::utils::now_millis;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{CommunityId, Rules};

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

    env.advance_time(Duration::from_secs(60));

    let channel_name = random_string();
    let channel_id =
        client::community::happy_path::create_channel(env, user.principal, community_id, is_public, channel_name.clone());

    let summary = client::community::happy_path::summary(env, user.principal, community_id);

    assert_eq!(summary.channels.len(), 2);
    assert!(
        summary
            .channels
            .iter()
            .any(|c| c.channel_id == channel_id && c.is_public == is_public && c.name == channel_name)
    );

    let community_details = client::community::happy_path::selected_initial(env, user.principal, community_id);
    let now = now_millis(env);

    if is_public {
        assert_eq!(community_details.public_channel_list_updated, now);
    } else {
        assert!(community_details.public_channel_list_updated < now);
    }
}

#[test]
fn existing_users_joined_to_new_public_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user, community_id } = init_test_data(env, canister_ids, *controller, true);

    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    client::community::happy_path::join_community(env, user2.principal, community_id);
    client::community::happy_path::join_community(env, user3.principal, community_id);

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
            messages_visible_to_non_members: None,
            permissions_v2: None,
            events_ttl: None,
            gate_config: None,
            external_url: None,
        },
    );

    let channel_id = if let community_canister::create_channel::Response::Success(result) = create_channel_response {
        result.channel_id
    } else {
        panic!()
    };

    let user2_summary = client::community::happy_path::summary(env, user2.principal, community_id);
    let user3_summary = client::community::happy_path::summary(env, user3.principal, community_id);

    assert!(user2_summary.channels.iter().any(|c| c.channel_id == channel_id));
    assert!(user3_summary.channels.iter().any(|c| c.channel_id == channel_id));
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
