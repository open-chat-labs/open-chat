use crate::env::ENV;
use crate::stable_memory::{STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID, get_stable_memory_map};
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, client};
use constants::DAY_IN_MS;
use ic_stable_structures::memory_manager::MemoryId;
use stable_memory_map::{KeyPrefix, UserMetricsKeyPrefix};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{Chat, ChatId, MessageContentInitial, MessageId, OptionUpdate, TextContent};

#[test]
fn delete_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let start = now_millis(env);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    env.advance_time(Duration::from_secs(1));

    let delete_direct_chat_response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: user2.user_id,
            block_user: false,
        },
    );

    assert!(
        matches!(
            delete_direct_chat_response,
            user_canister::delete_direct_chat::Response::Success
        ),
        "{delete_direct_chat_response:?}",
    );

    tick_many(env, 3);

    let user1_updates = client::user::happy_path::updates(env, &user1, start);
    assert_eq!(user1_updates.unwrap().direct_chats.removed, vec![ChatId::from(user2.user_id)]);

    let user1_initial_state = client::user::happy_path::initial_state(env, &user1);
    assert!(
        !user1_initial_state
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == user2.user_id)
    );

    let user2_initial_state = client::user::happy_path::initial_state(env, &user2);
    assert!(
        !user2_initial_state
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == user2.user_id)
    );
}

#[test]
fn stable_memory_garbage_collected_after_direct_chat_deleted() {
    const STABLE_MEMORY_MAP_MEMORY_ID: MemoryId = MemoryId::new(3);

    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let initial_stable_memory_map_keys = get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_MEMORY_ID).len();
    let initial_small_entries_keys =
        get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len();

    // Make the messages expire (though not within this test), so that the chat has expiring events
    client::user::happy_path::update_chat_settings(
        env,
        &user1,
        &user_canister::update_chat_settings::Args {
            user_id: user2.user_id,
            events_ttl: OptionUpdate::SetToSome(DAY_IN_MS),
        },
    );
    let small_entries_keys_before_messages =
        get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len();

    let message_id: MessageId = random_from_u128();
    let result = client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), Some(message_id));
    for _ in 0..3 {
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    }
    for _ in 0..2 {
        client::user::happy_path::send_message(
            env,
            &user1,
            user2.user_id,
            Some(result.message_index),
            MessageContentInitial::Text(TextContent { text: random_string() }),
            None,
            None,
        );
    }
    tick_many(env, 3);

    assert!(get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_MEMORY_ID).len() > initial_stable_memory_map_keys);
    // A message id for each message, an expiring event for each message in the main events list, two
    // entries (keyed by event and by timestamp) recording when the thread root was last updated, plus
    // the sender's metrics
    assert_eq!(
        get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        small_entries_keys_before_messages + 13
    );

    // Each canister only stores its own user's metrics for a direct chat, since only those are ever
    // read, so user1's messages are only counted by user1's canister and user2's reaction by user2's
    client::user::happy_path::add_reaction(env, &user2, user1.user_id, "👍", message_id);
    tick_many(env, 3);

    for (me, them) in [(&user1, &user2), (&user2, &user1)] {
        let prefix = UserMetricsKeyPrefix::new_from_chat(Chat::Direct(them.user_id.into()));
        let small_entries = get_stable_memory_map(env, me.canister(), STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID);
        assert!(small_entries.contains_key(&prefix.create_key(&me.user_id).as_ref().to_vec()));
        assert!(!small_entries.contains_key(&prefix.create_key(&them.user_id).as_ref().to_vec()));
    }

    let delete_direct_chat_response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: user2.user_id,
            block_user: false,
        },
    );
    assert!(
        matches!(
            delete_direct_chat_response,
            user_canister::delete_direct_chat::Response::Success
        ),
        "{delete_direct_chat_response:?}",
    );

    // Tick to garbage collect stable memory
    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys
    );
    assert_eq!(
        get_stable_memory_map(env, user1.canister(), STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        initial_small_entries_keys
    );
}
