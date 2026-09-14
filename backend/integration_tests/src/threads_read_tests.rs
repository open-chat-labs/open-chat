use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use std::collections::HashMap;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::MessageIndex;
use user_canister::mark_read::{ChannelMessagesRead, ChatMessagesRead, CommunityMessagesRead, ThreadRead};

#[test]
fn threads_read_in_group_returned_in_summaries_and_updates() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    for _ in 0..3 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }
    for root in 0..3u32 {
        for _ in 0..2 {
            client::group::happy_path::send_text_message(env, &user, group_id, Some(root.into()), random_string(), None);
        }
    }

    client::user::happy_path::mark_read(
        env,
        &user,
        vec![ChatMessagesRead {
            chat_id: group_id,
            read_up_to: Some(2.into()),
            threads: vec![
                ThreadRead {
                    root_message_index: 0.into(),
                    read_up_to: 1.into(),
                },
                ThreadRead {
                    root_message_index: 1.into(),
                    read_up_to: 0.into(),
                },
            ],
            date_read_pinned: None,
        }],
        Vec::new(),
    );

    let initial_state = client::user::happy_path::initial_state(env, &user);
    let group = initial_state
        .group_chats
        .summaries
        .iter()
        .find(|g| g.chat_id == group_id)
        .unwrap();
    assert_eq!(group.read_by_me_up_to, Some(2.into()));
    assert_eq!(group.threads_read, threads_read([(0, 1), (1, 0)]));

    env.advance_time(Duration::from_secs(1));
    let updates_since = now_millis(env);
    env.advance_time(Duration::from_secs(1));

    client::user::happy_path::mark_read(
        env,
        &user,
        vec![ChatMessagesRead {
            chat_id: group_id,
            read_up_to: None,
            threads: vec![ThreadRead {
                root_message_index: 2.into(),
                read_up_to: 1.into(),
            }],
            date_read_pinned: None,
        }],
        Vec::new(),
    );

    let updates = client::user::happy_path::updates(env, &user, updates_since).unwrap();
    let group_updates = updates.group_chats.updated.iter().find(|g| g.chat_id == group_id).unwrap();
    assert_eq!(group_updates.threads_read, threads_read([(2, 1)]));

    let initial_state = client::user::happy_path::initial_state(env, &user);
    let group = initial_state
        .group_chats
        .summaries
        .iter()
        .find(|g| g.chat_id == group_id)
        .unwrap();
    assert_eq!(group.threads_read, threads_read([(0, 1), (1, 0), (2, 1)]));
}

#[test]
fn threads_read_in_channel_returned_in_summaries_and_updates() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), false, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user.principal, community_id, false, random_string());

    for _ in 0..2 {
        client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, random_string(), None);
    }
    for root in 0..2u32 {
        for _ in 0..2 {
            client::community::happy_path::send_text_message(
                env,
                &user,
                community_id,
                channel_id,
                Some(root.into()),
                random_string(),
                None,
            );
        }
    }

    client::user::happy_path::mark_read(
        env,
        &user,
        Vec::new(),
        vec![CommunityMessagesRead {
            community_id,
            channels_read: vec![ChannelMessagesRead {
                channel_id,
                read_up_to: Some(1.into()),
                threads: vec![ThreadRead {
                    root_message_index: 0.into(),
                    read_up_to: 1.into(),
                }],
                date_read_pinned: None,
            }],
        }],
    );

    let initial_state = client::user::happy_path::initial_state(env, &user);
    let community = initial_state
        .communities
        .summaries
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();
    let channel = community.channels.iter().find(|c| c.channel_id == channel_id).unwrap();
    assert_eq!(channel.read_by_me_up_to, Some(1.into()));
    assert_eq!(channel.threads_read, threads_read([(0, 1)]));

    env.advance_time(Duration::from_secs(1));
    let updates_since = now_millis(env);
    env.advance_time(Duration::from_secs(1));

    client::user::happy_path::mark_read(
        env,
        &user,
        Vec::new(),
        vec![CommunityMessagesRead {
            community_id,
            channels_read: vec![ChannelMessagesRead {
                channel_id,
                read_up_to: None,
                threads: vec![ThreadRead {
                    root_message_index: 1.into(),
                    read_up_to: 0.into(),
                }],
                date_read_pinned: None,
            }],
        }],
    );

    let updates = client::user::happy_path::updates(env, &user, updates_since).unwrap();
    let community_updates = updates
        .communities
        .updated
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();
    let channel_updates = community_updates
        .channels
        .iter()
        .find(|c| c.channel_id == channel_id)
        .unwrap();
    assert_eq!(channel_updates.threads_read, threads_read([(1, 0)]));
}

fn threads_read<const N: usize>(entries: [(u32, u32); N]) -> HashMap<MessageIndex, MessageIndex> {
    entries.into_iter().map(|(r, u)| (r.into(), u.into())).collect()
}
