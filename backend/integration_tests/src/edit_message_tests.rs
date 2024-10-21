use crate::env::ENV;
use crate::{client, TestEnv};
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_from_u128;
use types::{ChatEvent, MessageContentInitial, TextContent};

#[test]
fn edit_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

    let send_message_result = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let new_text = "TEXT!";
    client::user::happy_path::edit_text_message(env, &user1, user2.user_id, message_id, new_text, None);

    env.tick();

    let user1_event =
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_result.event_index])
            .events
            .pop()
            .unwrap();

    let user2_event =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index])
            .events
            .pop()
            .unwrap();

    let ChatEvent::Message(m1) = user1_event.event else { panic!() };
    assert!(m1.edited);
    assert_eq!(m1.content.text().unwrap(), new_text);

    let ChatEvent::Message(m2) = user2_event.event else { panic!() };
    assert!(m2.edited);
    assert_eq!(m2.content.text().unwrap(), new_text);
}

#[test_case(true)]
#[test_case(false)]
fn update_block_level_markdown_succeeds(starting_value: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

    let user_canister::send_message_v2::Response::Success(send_message_result) = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Text(TextContent {
                text: "TEXT".to_string(),
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: starting_value,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
        },
    ) else {
        panic!()
    };

    let new_value = !starting_value;
    client::user::happy_path::edit_text_message(env, &user1, user2.user_id, message_id, "TEXT", Some(new_value));

    env.tick();

    let user1_event =
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_result.event_index])
            .events
            .pop()
            .unwrap();

    let user2_event =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index])
            .events
            .pop()
            .unwrap();

    let ChatEvent::Message(m1) = user1_event.event else { panic!() };
    assert!(m1.edited);
    assert_eq!(m1.block_level_markdown, new_value);

    let ChatEvent::Message(m2) = user2_event.event else { panic!() };
    assert!(m2.edited);
    assert_eq!(m2.block_level_markdown, new_value);
}
