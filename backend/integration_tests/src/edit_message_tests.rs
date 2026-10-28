use crate::env::ENV;
use crate::utils::{tick_many, tick_until};
use crate::{TestEnv, User, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashMap;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    BlobReference, ChatEvent, ChatId, EventIndex, ImageContent, Message, MessageContent, MessageContentInitial, PollConfig,
    PollContent, PollVotes, TextContent, ThumbnailData, TotalVotes, UnitResult, UserId,
};

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

    // The edit is sent after the message, so this is long enough for both to reach user2's canister,
    // one after the other, even if the users are on different subnets
    tick_many(env, 20);

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

    let multi_user_canister::send_message_v2::Response::Success(send_message_result) = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::send_message_v2::Args {
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
            og_previews: Vec::new(),
        },
    ) else {
        panic!()
    };

    let new_value = !starting_value;
    client::user::happy_path::edit_text_message(env, &user1, user2.user_id, message_id, "TEXT", Some(new_value));

    // The edit is sent after the message, so this is long enough for both to reach user2's canister,
    // one after the other, even if the users are on different subnets
    tick_many(env, 20);

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

#[test]
fn edit_thread_reply_in_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let root = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "ROOT", None);

    let message_id = random_from_u128();
    client::user::happy_path::send_message(
        env,
        &user1,
        user2.user_id,
        Some(root.message_index),
        MessageContentInitial::Text(TextContent {
            text: "REPLY".to_string(),
        }),
        None,
        Some(message_id),
    );

    tick_many(env, 10);

    let new_text = "REPLY!";
    let response = client::user::edit_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::edit_message_v2::Args {
            user_id: user2.user_id,
            thread_root_message_index: Some(root.message_index),
            message_id,
            content: MessageContentInitial::Text(TextContent {
                text: new_text.to_string(),
            }),
            block_level_markdown: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(response, multi_user_canister::edit_message_v2::Response::Success),
        "{response:?}"
    );

    tick_many(env, 10);

    for (user, them) in [(&user1, user2.user_id), (&user2, user1.user_id)] {
        let message = client::user::happy_path::thread_message(env, user, them, root.message_index, message_id);
        assert!(message.edited);
        assert_eq!(message.content.text().unwrap(), new_text);
    }

    // The root message must be unaffected
    let root_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![root.event_index])
        .events
        .pop()
        .unwrap();
    let ChatEvent::Message(root_message) = root_event.event else {
        panic!()
    };
    assert!(!root_message.edited);
    assert_eq!(root_message.content.text().unwrap(), "ROOT");
}

#[test]
fn editing_an_image_changes_only_its_caption() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let message_id = random_from_u128();
    let sent = client::group::happy_path::send_message(env, &user, group_id, None, image(Some("old")), None, Some(message_id));

    for caption in [Some("new"), None] {
        let response = client::group::edit_message_text(
            env,
            user.principal,
            group_id.into(),
            &group_canister::edit_message_text::Args {
                thread_root_message_index: None,
                message_id,
                text: caption.map(|c| c.to_string()),
                block_level_markdown: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(matches!(response, UnitResult::Success), "{response:?}");

        let message = group_message(env, &user, group_id, sent.event_index);
        assert!(message.edited);
        assert_image(&message.content, caption);
    }
}

#[test]
fn edits_to_anything_but_text_are_refused() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    let poll_id = random_from_u128();
    let poll = client::group::happy_path::send_message(env, &user, group_id, None, poll(), None, Some(poll_id));
    let text_id = random_from_u128();
    let text = client::group::happy_path::send_text_message(env, &user, group_id, None, "TEXT", Some(text_id));

    for (message_id, sent, new_text, expected_error) in [
        (poll_id, &poll, Some("Pick another"), OCErrorCode::InvalidMessageType),
        // A text message can't lose its text
        (text_id, &text, None, OCErrorCode::InvalidMessageContent),
    ] {
        let response = client::group::edit_message_text(
            env,
            user.principal,
            group_id.into(),
            &group_canister::edit_message_text::Args {
                thread_root_message_index: None,
                message_id,
                text: new_text.map(|t| t.to_string()),
                block_level_markdown: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(
            matches!(&response, UnitResult::Error(e) if e.matches_code(expected_error)),
            "{response:?}"
        );
        assert!(!group_message(env, &user, group_id, sent.event_index).edited);
    }
}

// An older client sends the whole content, of which only the text is taken
#[test]
fn an_older_clients_edit_only_changes_the_text() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let message_id = random_from_u128();
    let sent = client::group::happy_path::send_message(env, &user, group_id, None, image(Some("old")), None, Some(message_id));

    let response = client::group::edit_message_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::edit_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Text(TextContent { text: "new".to_string() }),
            block_level_markdown: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    assert_image(&group_message(env, &user, group_id, sent.event_index).content, Some("new"));
}

#[test]
fn an_older_clients_edit_in_a_direct_chat_only_changes_the_text_in_both_copies() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    let message_id = random_from_u128();
    let sent = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let response = client::user::edit_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::edit_message_v2::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: image(Some("new")),
            block_level_markdown: None,
            og_previews: Vec::new(),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    tick_until(env, |env| {
        direct_message(env, &user2, user1.user_id, sent.event_index).content.text() == Some("new")
    });

    for (user, them) in [(&user1, user2.user_id), (&user2, user1.user_id)] {
        let message = direct_message(env, user, them, sent.event_index);
        assert!(message.edited);
        assert!(
            matches!(&message.content, MessageContent::Text(t) if t.text == "new"),
            "{:?}",
            message.content
        );
    }
}

#[test]
fn edit_message_text_in_a_channel_succeeds() {
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
    let message_id = random_from_u128();
    let sent =
        client::community::happy_path::send_text_message(env, &user, community_id, channel_id, None, "TEXT", Some(message_id));

    let response = client::community::edit_message_text(
        env,
        user.principal,
        community_id.into(),
        &community_canister::edit_message_text::Args {
            channel_id,
            thread_root_message_index: None,
            message_id,
            text: Some("TEXT!".to_string()),
            block_level_markdown: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let event = client::community::happy_path::events_by_index(env, &user, community_id, channel_id, vec![sent.event_index])
        .events
        .pop()
        .unwrap();
    let ChatEvent::Message(message) = event.event else { panic!() };
    assert!(message.edited);
    assert_eq!(message.content.text(), Some("TEXT!"));
}

fn image(caption: Option<&str>) -> MessageContentInitial {
    MessageContentInitial::Image(ImageContent {
        width: 100,
        height: 100,
        thumbnail_data: ThumbnailData("data:image/jpeg;base64,".to_string()),
        caption: caption.map(|c| c.to_string()),
        mime_type: "image/jpeg".to_string(),
        blob_reference: Some(BlobReference {
            canister_id: Principal::from_slice(&[1]),
            blob_id: 7,
        }),
    })
}

fn assert_image(content: &MessageContent, caption: Option<&str>) {
    let MessageContent::Image(image) = content else {
        panic!("Expected an image: {content:?}")
    };
    assert_eq!(image.caption.as_deref(), caption);
    assert_eq!(image.blob_reference.as_ref().map(|b| b.blob_id), Some(7));
}

fn poll() -> MessageContentInitial {
    MessageContentInitial::Poll(PollContent {
        config: PollConfig {
            text: Some("Pick one".to_string()),
            options: vec!["a".to_string(), "b".to_string()],
            end_date: None,
            anonymous: false,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: false,
            allow_user_to_change_vote: false,
        },
        votes: PollVotes {
            total: TotalVotes::Visible(HashMap::new()),
            user: Vec::new(),
        },
        ended: false,
    })
}

fn group_message(env: &PocketIc, user: &User, group_id: ChatId, event_index: EventIndex) -> Box<Message> {
    let event = client::group::happy_path::events_by_index(env, user, group_id, vec![event_index])
        .events
        .pop()
        .unwrap();
    let ChatEvent::Message(message) = event.event else { panic!() };
    message
}

fn direct_message(env: &PocketIc, user: &User, them: UserId, event_index: EventIndex) -> Box<Message> {
    let event = client::user::happy_path::events_by_index(env, user, them, vec![event_index])
        .events
        .pop()
        .unwrap();
    let ChatEvent::Message(message) = event.event else { panic!() };
    message
}
