use crate::env::ENV;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::OptionUpdate;

#[test]
fn disappearing_messages_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user.principal, community_id, true, random_string());

    client::community::happy_path::update_channel(
        env,
        user.principal,
        community_id,
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::SetToSome(1000),
            gate: OptionUpdate::NoChange,
            gate_config: OptionUpdate::NoChange,
            public: None,
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::NoChange,
        },
    );

    let send_message_response1 =
        client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "abc", None);

    assert!(client::community::happy_path::events_by_index(
        env,
        &user,
        community_id,
        channel_id,
        vec![send_message_response1.event_index]
    )
    .events
    .first()
    .is_some());

    env.advance_time(Duration::from_millis(2000));
    env.tick();

    assert!(client::community::happy_path::events_by_index(
        env,
        &user,
        community_id,
        channel_id,
        vec![send_message_response1.event_index]
    )
    .events
    .first()
    .is_none());

    client::community::happy_path::update_channel(
        env,
        user.principal,
        community_id,
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::SetToNone,
            gate: OptionUpdate::NoChange,
            gate_config: OptionUpdate::NoChange,
            public: None,
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::NoChange,
        },
    );

    let send_message_response2 =
        client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "xyz", None);

    env.advance_time(Duration::from_secs(100000));
    env.tick();

    assert!(client::community::happy_path::events_by_index(
        env,
        &user,
        community_id,
        channel_id,
        vec![send_message_response2.event_index]
    )
    .events
    .first()
    .is_some());
}
