use crate::env::ENV;
use crate::rng::random_message_id;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::ChatEvent;

#[test_case(1)]
#[test_case(3)]
#[test_case(5)]
fn retries_after_failures(failures: usize) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let message_id = random_message_id();

    let send_message_result = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));
    env.tick();

    let events_response1 =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index]);

    assert_eq!(events_response1.events.len(), 1);
    assert!(matches!(events_response1.events[0].event, ChatEvent::Message(_)));

    env.stop_canister(user2.user_id.into(), Some(canister_ids.local_user_index))
        .unwrap();

    client::user::happy_path::add_reaction(env, &user1, user2.user_id, "1", message_id);

    for _ in 1..failures {
        env.advance_time(Duration::from_secs(100));
        env.tick();
    }

    env.start_canister(user2.user_id.into(), Some(canister_ids.local_user_index))
        .unwrap();

    env.tick();
    env.advance_time(Duration::from_secs(100));
    tick_many(env, 3);

    let events_response1 =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index]);

    if let Some(ChatEvent::Message(m)) = events_response1.events.last().map(|e| &e.event) {
        assert_eq!(m.reactions.len(), 1);
    } else {
        panic!();
    }
}
