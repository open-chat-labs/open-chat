use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv};
use std::ops::Deref;
use types::OptionUpdate;

#[test]
fn make_private_channel_public_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["abc".to_string()]);
    let channel_id =
        client::community::happy_path::create_channel(env, user1.principal, community_id, false, "xyz".to_string());

    for i in 0..5 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, i.to_string(), None);
    }

    client::community::happy_path::update_channel(
        env,
        &user1,
        community_id,
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions: None,
            gate: OptionUpdate::NoChange,
            public: Some(true),
        },
    );

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    let channel_summary = client::community::happy_path::channel_summary(env, &user2, community_id, channel_id);

    assert!(channel_summary.is_public);
    assert_eq!(channel_summary.min_visible_event_index, 7.into());
    assert_eq!(channel_summary.min_visible_message_index, 5.into());
}
