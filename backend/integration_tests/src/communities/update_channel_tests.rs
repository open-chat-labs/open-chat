use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;;
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
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);

    let channel_id = if make_public {
        client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string())
    } else {
        client::community::happy_path::create_gated_channel(env, user1.principal, community_id, true, random_string(), AccessGate::DiamondMember)
    };

    for i in 0..5 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, i.to_string(), None);
    }

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);
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
            gate: if !make_public { OptionUpdate::SetToNone } else { OptionUpdate::NoChange },
            public: make_public.then_some(true),
        },
    );

    // Check that user2 has been added to the channel
    let channel_summary = client::community::happy_path::channel_summary(env, &user2, community_id, channel_id);

    assert!(channel_summary.is_public);
    assert!(channel_summary.gate.is_none());
    assert_eq!(channel_summary.min_visible_event_index, 7.into());
    assert_eq!(channel_summary.min_visible_message_index, 5.into());
}
