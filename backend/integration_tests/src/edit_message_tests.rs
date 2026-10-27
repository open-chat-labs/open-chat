use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    BlobReference, ChatEvent, DeletedBy, GroupPermissionRole, ImageContent, MessageContentInitial, OptionUpdate,
    OptionalGroupPermissions, OptionalMessagePermissions, TextContent, ThumbnailData, UnitResult,
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
fn a_user_cant_edit_a_message_into_content_they_couldnt_send() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let message_id = random_from_u128();
    let sent = client::group::happy_path::send_text_message(env, &user, group_id, None, "TEXT", Some(message_id));

    for content in [
        MessageContentInitial::Text(TextContent { text: String::new() }),
        MessageContentInitial::Deleted(DeletedBy {
            deleted_by: user.user_id,
            timestamp: 0,
        }),
    ] {
        let response = client::group::edit_message_v2(
            env,
            user.principal,
            group_id.into(),
            &group_canister::edit_message_v2::Args {
                thread_root_message_index: None,
                message_id,
                content,
                block_level_markdown: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(matches!(response, UnitResult::Error(_)), "{response:?}");
    }

    let event = client::group::happy_path::events_by_index(env, &user, group_id, vec![sent.event_index])
        .events
        .pop()
        .unwrap();
    let ChatEvent::Message(message) = event.event else { panic!() };
    assert!(!message.edited);
    assert_eq!(message.content.text().unwrap(), "TEXT");
}

#[test]
fn a_member_cant_edit_a_message_into_a_type_they_cant_send() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let owner = client::register_user(env, canister_ids);
    let member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &owner,
        canister_ids.local_user_index(env, group_id),
        group_id,
        vec![(member.user_id, member.principal)],
    );
    // Only admins may post images
    client::group::happy_path::update_group(
        env,
        owner.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            permissions_v2: Some(OptionalGroupPermissions {
                message_permissions: Some(OptionalMessagePermissions {
                    image: OptionUpdate::SetToSome(GroupPermissionRole::Admins),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );

    let message_id = random_from_u128();
    client::group::happy_path::send_text_message(env, &member, group_id, None, "TEXT", Some(message_id));

    let edit = |env: &mut pocket_ic::PocketIc, content| {
        client::group::edit_message_v2(
            env,
            member.principal,
            group_id.into(),
            &group_canister::edit_message_v2::Args {
                thread_root_message_index: None,
                message_id,
                content,
                block_level_markdown: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        )
    };

    let image = MessageContentInitial::Image(ImageContent {
        width: 10,
        height: 10,
        thumbnail_data: ThumbnailData(String::new()),
        caption: Some("TEXT".to_string()),
        mime_type: "image/png".to_string(),
        blob_reference: Some(BlobReference {
            canister_id: canister_ids.local_user_index(env, group_id),
            blob_id: 1,
        }),
    });
    let response = edit(env, image);
    assert!(matches!(response, UnitResult::Error(_)), "{response:?}");

    // Keeping the type, they can still edit it
    let response = edit(
        env,
        MessageContentInitial::Text(TextContent {
            text: "TEXT!".to_string(),
        }),
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}
