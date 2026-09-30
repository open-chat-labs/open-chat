use crate::env::ENV;
use crate::{TestEnv, client};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;

// `details_last_updated` tells a client whether the details it holds for a chat or community (its
// members etc) are still up to date, so unlike `last_updated` it must not move on with each message

#[test]
fn group_details_last_updated_only_moves_on_when_the_details_change() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);

    let summary = client::group::happy_path::summary(env, user1.principal, group_id);
    assert!(summary.details_last_updated > 0);
    assert!(summary.details_last_updated <= summary.last_updated);

    env.advance_time(Duration::from_secs(1));
    client::group::happy_path::send_text_message(env, &user1, group_id, None, "hello", None);

    let updates = client::group::happy_path::summary_updates(env, user1.principal, group_id, summary.last_updated).unwrap();
    assert!(updates.last_updated > summary.last_updated);
    assert_eq!(updates.details_last_updated, Some(summary.details_last_updated));

    env.advance_time(Duration::from_secs(1));
    client::group::happy_path::join_group(env, user2.principal, group_id);

    let updates = client::group::happy_path::summary_updates(env, user1.principal, group_id, updates.last_updated).unwrap();
    assert!(updates.details_last_updated.unwrap() > summary.details_last_updated);

    let summary = client::group::happy_path::summary(env, user1.principal, group_id);
    assert_eq!(Some(summary.details_last_updated), updates.details_last_updated);
}

#[test]
fn community_and_channel_details_last_updated_only_move_on_when_their_details_change() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    let channel = summary.channels.iter().find(|c| c.channel_id == channel_id).unwrap();
    assert!(summary.details_last_updated > 0);
    assert!(channel.details_last_updated > 0);

    env.advance_time(Duration::from_secs(1));
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, "hello", None);

    let updates =
        client::community::happy_path::summary_updates(env, user1.principal, community_id, summary.last_updated).unwrap();
    let channel_updates = updates.channels_updated.iter().find(|c| c.channel_id == channel_id).unwrap();
    assert!(updates.last_updated > summary.last_updated);
    assert!(channel_updates.last_updated > channel.last_updated);
    assert_eq!(updates.details_last_updated, Some(summary.details_last_updated));
    assert_eq!(channel_updates.details_last_updated, Some(channel.details_last_updated));

    // A user joining the community is added to its public channel, so the details of both change
    env.advance_time(Duration::from_secs(1));
    client::community::happy_path::join_community(env, user2.principal, community_id);

    let updates =
        client::community::happy_path::summary_updates(env, user1.principal, community_id, updates.last_updated).unwrap();
    let channel_updates = updates.channels_updated.iter().find(|c| c.channel_id == channel_id).unwrap();
    assert!(updates.details_last_updated.unwrap() > summary.details_last_updated);
    assert!(channel_updates.details_last_updated.unwrap() > channel.details_last_updated);
}
