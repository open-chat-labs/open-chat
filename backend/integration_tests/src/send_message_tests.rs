use crate::client;
use crate::rng::random_message_id;
use crate::setup::{return_env, setup_env, TestEnv};
use types::{ChatEvent, MessageContent, TextContent};

#[test]
fn send_message_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user1 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    let send_message_result = client::user::happy_path::send_text_message(&mut env, &user1, user2.user_id, "TEXT", None);

    let events_response =
        client::user::happy_path::events_by_index(&env, &user1, user2.user_id, vec![send_message_result.event_index]);

    assert_eq!(events_response.events.len(), 1);
    assert!(matches!(events_response.events[0].event, ChatEvent::Message(_)));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn empty_message_fails() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user1 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    let send_message_args = user_canister::send_message::Args {
        recipient: user2.user_id,
        thread_root_message_index: None,
        message_id: random_message_id(),
        sender_name: user1.username(),
        content: MessageContent::Text(TextContent { text: String::default() }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = client::user::send_message(&mut env, user1.principal, user1.canister(), &send_message_args);
    if !matches!(response, user_canister::send_message::Response::MessageEmpty) {
        panic!("SendMessage was expected to return MessageEmpty but did not: {response:?}");
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn text_too_long_fails() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user1 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    let send_message_args = user_canister::send_message::Args {
        recipient: user2.user_id,
        thread_root_message_index: None,
        message_id: random_message_id(),
        sender_name: user1.username(),
        content: MessageContent::Text(TextContent {
            text: (0..5001).into_iter().map(|_| '1').collect(),
        }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = client::user::send_message(&mut env, user1.principal, user1.canister(), &send_message_args);
    if !matches!(response, user_canister::send_message::Response::TextTooLong(5000)) {
        panic!("SendMessage was expected to return TextTooLong(5000) but did not: {response:?}");
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}
