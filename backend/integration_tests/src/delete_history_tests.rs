use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{EventIndex, FileContent, MessageContentInitial};

#[test]
fn delete_group_history() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    env.advance_time(Duration::from_secs(1));
    client::group::happy_path::send_text_message(env, &user, group_id, None, "abc", None);
    env.advance_time(Duration::from_secs(1));
    client::group::happy_path::send_text_message(env, &user, group_id, None, "bcd", None);
    env.advance_time(Duration::from_secs(1));

    let delete_before = now_millis(env);

    client::group::happy_path::send_text_message(env, &user, group_id, None, "cde", None);

    client::group::happy_path::delete_history(env, &user, group_id, delete_before);

    env.tick();

    let events_response = client::group::happy_path::events(env, &user, group_id, EventIndex::from(0), true, 100, 100);

    println!("Events response: {:?}", events_response);

    // There should be 3 events left: created, message and "history deleted"
    assert_eq!(events_response.events.len(), 3);
}

#[test]
fn files_sent_in_thread_replies_are_deleted_with_their_root_message() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    let root = client::group::happy_path::send_text_message(env, &user, group_id, None, "root", None);
    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        user.principal,
        canister_ids.storage_index,
        100,
        vec![group_id.into()],
    );
    client::group::happy_path::send_message(
        env,
        &user,
        group_id,
        Some(root.message_index),
        MessageContentInitial::File(FileContent {
            name: random_string(),
            caption: None,
            mime_type: "abc".to_string(),
            file_size: 100,
            blob_reference: Some(blob_reference.clone()),
        }),
        None,
        None,
    );

    env.advance_time(Duration::from_secs(1));
    client::group::happy_path::delete_history(env, &user, group_id, now_millis(env));

    for _ in 0..20 {
        if !client::storage_bucket::happy_path::file_exists(
            env,
            user.principal,
            blob_reference.canister_id,
            blob_reference.blob_id,
        ) {
            return;
        }
        env.tick();
    }
    panic!("The file sent in the thread reply was not deleted");
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
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    let initial_stable_memory_map_keys = get_stable_memory_map(env, group_id, STABLE_MEMORY_MAP_MEMORY_ID).len();

    for _ in 0..5 {
        let result = client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);

        for _ in 0..5 {
            client::group::happy_path::send_text_message(
                env,
                &user,
                group_id,
                Some(result.message_index),
                random_string(),
                None,
            );
        }
    }

    assert_eq!(
        get_stable_memory_map(env, group_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 30
    );

    env.advance_time(Duration::from_secs(1));
    env.tick();

    client::group::happy_path::delete_history(env, &user, group_id, now_millis(env));

    // Tick once to delete the messages
    env.tick();

    // Tick again to garbage collect stable memory
    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, group_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 1
    );
}
