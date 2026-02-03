use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::EventIndex;

#[test]
fn delete_channel_history() {
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

    env.advance_time(Duration::from_secs(1));
    client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "abc", None);
    env.advance_time(Duration::from_secs(1));
    client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "bcd", None);
    env.advance_time(Duration::from_secs(1));

    let delete_before = now_millis(env);

    client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "cde", None);

    client::community::happy_path::delete_history(env, &user, community_id, channel_id, delete_before);

    env.tick();

    let events_response =
        client::community::happy_path::events(env, &user, community_id, channel_id, EventIndex::from(0), true, 100, 100);

    println!("Events response: {:?}", events_response);

    // There should be 3 events left: created, message and "history deleted"
    assert_eq!(events_response.events.len(), 3);
}

#[test]
fn stable_memory_garbage_collected_after_messages_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::summary(env, user.principal, community_id)
        .channels
        .first()
        .unwrap()
        .channel_id;

    let initial_stable_memory_map_keys = get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len();

    for _ in 0..5 {
        let result =
            client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, random_string(), None);

        for _ in 0..5 {
            client::community::happy_path::send_text_message(
                env,
                &user,
                community_id,
                channel_id,
                Some(result.message_index),
                random_string(),
                None,
            );
        }
    }

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 30
    );

    env.advance_time(Duration::from_secs(1));
    env.tick();

    client::community::happy_path::delete_history(env, &user, community_id, channel_id, now_millis(env));

    // Tick once to delete the messages
    env.tick();

    // Tick again to garbage collect stable memory
    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 1
    );
}
