use crate::env::ENV;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{AccessGate, OptionUpdate};

#[test_case(true)]
#[test_case(false)]
fn members_added_if_channel_made_public_or_gate_removed(make_public: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_diamond_user(env, canister_ids, *controller);
    let user3 = client::register_user(env, canister_ids);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);

    let channel_id = if make_public {
        client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string())
    } else {
        client::community::happy_path::create_gated_channel(
            env,
            user1.principal,
            community_id,
            true,
            random_string(),
            AccessGate::DiamondMember,
        )
    };

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index,
        community_id,
        channel_id,
        vec![user2.user_id],
    );
    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    for i in 0..5 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, i.to_string(), None);
    }

    client::community::happy_path::leave_channel(env, user2.principal, community_id, channel_id);

    client::local_user_index::happy_path::join_community(
        env,
        user3.principal,
        canister_ids.local_user_index,
        community_id,
        None,
    );
    client::community::happy_path::update_channel(
        env,
        user1.principal,
        community_id,
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::NoChange,
            gate: OptionUpdate::NoChange,
            gate_config: if !make_public { OptionUpdate::SetToNone } else { OptionUpdate::NoChange },
            public: make_public.then_some(true),
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::NoChange,
        },
    );

    // Check that user2 has not been re-added to the channel
    let user2_channel_summary = client::community::happy_path::summary(env, &user2, community_id);

    assert!(!user2_channel_summary.channels.iter().any(|c| c.channel_id == channel_id));

    // Check that user3 has been added to the channel
    let user3_channel_summary = client::community::happy_path::channel_summary(env, &user3, community_id, channel_id);

    if make_public {
        assert!(user3_channel_summary.is_public);
        assert_eq!(user3_channel_summary.min_visible_event_index, 10.into());
        assert_eq!(user3_channel_summary.min_visible_message_index, 5.into());
    } else {
        assert!(user3_channel_summary.gate.is_none());
        assert_eq!(user3_channel_summary.min_visible_event_index, 0.into());
        assert_eq!(user3_channel_summary.min_visible_message_index, 0.into());
    }
}
