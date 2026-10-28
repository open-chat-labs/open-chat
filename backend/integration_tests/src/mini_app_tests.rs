use crate::bot_tests::default_bot_definition;
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use jwt::{Claims, verify_and_decode};
use local_user_index_canister::access_token_v2::{self, BotMessageSessionArgs};
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    AutonomousConfig, BlobReference, BotChatContext, BotInstallationLocation, BotMessageContent, BotMessageSessionClaims,
    BotPermissions, CLAIM_TYPE_BOT_MESSAGE_SESSION, CanisterId, ChannelId, Chat, ChatEvent, ChatPermission, CommunityId,
    EventIndex, MessageContent, MessageContentInitial, MessageId, MessageIndex, MessagePermission, MiniAppContent,
    MiniAppImage, MiniAppStatus, MiniAppUpdate, OptionUpdate, TextContent, UnitResult, UserId,
};

#[test]
fn a_bot_posts_a_mini_app_card_which_cant_be_edited() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();

    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    tick_many(env, 3);

    assert_eq!(
        card_text(env, &member, community_id, channel_id, result.event_index),
        card().text
    );
    let events =
        client::community::happy_path::events_by_index(env, &member, community_id, channel_id, vec![result.event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    let MessageContent::MiniApp(content) = &message.content else {
        panic!("Expected a mini app: {:?}", message.content);
    };
    assert_eq!(
        content.image.as_ref().map(|i| (i.width, i.height, i.blob_reference.blob_id)),
        Some((600, 400, 7))
    );

    // The bot reads its card back
    let response = client::local_user_index::bot_chat_events(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_chat_events::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            events: EventsSelectionCriteria::ByIndex(EventsByIndexArgs {
                events: vec![result.event_index],
            }),
        },
    );
    let local_user_index_canister::bot_chat_events::Response::Success(events) = response else {
        panic!("'bot_chat_events' error: {response:?}");
    };
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert!(
        matches!(&message.content, MessageContent::MiniApp(c) if c.text == card().text),
        "Expected a mini app: {:?}",
        message.content
    );

    // A card never changes: everything the app shows is the bot's own page
    let response = client::local_user_index::bot_edit_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_edit_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id,
            content: BotMessageContent::MiniApp(MiniAppContent {
                text: "**Uno** · game over".to_string(),
                ..card()
            }),
            block_level_markdown: false,
            og_previews: None,
        },
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidMessageType)),
        "Expected InvalidMessageType: {response:?}"
    );
    assert_eq!(
        card_text(env, &member, community_id, channel_id, result.event_index),
        card().text
    );
}

#[test]
fn a_bot_without_the_mini_app_permission_cant_post_one() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        community_id,
        channel_id,
        local_user_index,
        ..
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::Text,
    );

    let response = send(
        env,
        bot_principal,
        local_user_index,
        Chat::Channel(community_id, channel_id),
        random_from_u128(),
        card(),
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "Expected InitiatorNotAuthorized: {response:?}"
    );
}

// A card is sent whole: only its game's state changes, which the bot updates
#[test]
fn a_card_is_sent_finalised() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        community_id,
        channel_id,
        local_user_index,
        ..
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );

    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(Chat::Channel(community_id, channel_id)),
            thread: None,
            message_id: Some(random_from_u128()),
            replies_to: None,
            content: BotMessageContent::MiniApp(card()),
            block_level_markdown: false,
            finalised: false,
            og_previews: None,
            bridged_from: None,
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );
}

// The bot keeps its card up to date as its game goes on: who's playing, whose move it is, and the
// result. The message isn't marked as edited, and once the game is finished the card never changes.
#[test]
fn a_bot_updates_its_card_as_its_game_goes_on() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    let update = |env: &mut PocketIc, update: MiniAppUpdate| {
        client::local_user_index::bot_update_mini_app(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_update_mini_app::Args {
                chat_context: BotChatContext::Autonomous(chat),
                thread: None,
                message_id,
                update,
            },
        )
    };
    let read = |env: &PocketIc| {
        let events =
            client::community::happy_path::events_by_index(env, &member, community_id, channel_id, vec![sent.event_index]);
        let ChatEvent::Message(message) = &events.events[0].event else {
            panic!("Expected a message: {:?}", events.events[0].event);
        };
        let MessageContent::MiniApp(content) = &message.content else {
            panic!("Expected a mini app: {:?}", message.content);
        };
        assert!(!message.edited);
        content.clone()
    };

    let response = update(
        env,
        MiniAppUpdate {
            status: Some(MiniAppStatus::Active),
            players: Some(vec![owner.user_id, member.user_id]),
            spectator_count: Some(3),
            waiting_for: OptionUpdate::SetToSome(vec![member.user_id]),
            ..Default::default()
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let card = read(env);
    assert_eq!(card.status, MiniAppStatus::Active);
    assert_eq!(card.players, vec![owner.user_id, member.user_id]);
    assert_eq!(card.waiting_for, Some(vec![member.user_id]));
    assert_eq!(card.spectator_count, 3);
    assert_eq!(card.max_players, Some(4));
    assert_eq!(card.text, self::card().text);

    let response = update(
        env,
        MiniAppUpdate {
            status: Some(MiniAppStatus::Finished),
            waiting_for: OptionUpdate::SetToNone,
            result: OptionUpdate::SetToSome("Bob won".to_string()),
            ..Default::default()
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let card = read(env);
    assert_eq!(card.status, MiniAppStatus::Finished);
    assert_eq!(card.waiting_for, None);
    assert_eq!(card.result.as_deref(), Some("Bob won"));

    let response = update(
        env,
        MiniAppUpdate {
            status: Some(MiniAppStatus::Active),
            ..Default::default()
        },
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected the finished card not to change: {response:?}"
    );
    assert_eq!(read(env).status, MiniAppStatus::Finished);
}

// Only the bot which posted a card updates it, and its players are members of the chat
#[test]
fn only_the_cards_bot_updates_it_with_the_chats_members() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        community_id,
        channel_id,
        local_user_index,
        ..
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let (_, other_bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)),
        "'bot_send_message' error: {response:?}"
    );
    let outsider = client::register_user(env, canister_ids);

    for (caller, players, expected) in [
        (other_bot_principal, vec![owner.user_id], OCErrorCode::InitiatorNotAuthorized),
        (
            bot_principal,
            vec![owner.user_id, outsider.user_id],
            OCErrorCode::InvalidRequest,
        ),
    ] {
        let response = client::local_user_index::bot_update_mini_app(
            env,
            caller,
            local_user_index,
            &local_user_index_canister::bot_update_mini_app::Args {
                chat_context: BotChatContext::Autonomous(chat),
                thread: None,
                message_id,
                update: MiniAppUpdate {
                    players: Some(players),
                    ..Default::default()
                },
            },
        );
        assert!(
            matches!(&response, UnitResult::Error(e) if e.matches_code(expected)),
            "Unexpected response: {response:?}"
        );
    }
}

// In a group too, and in a thread: members' clients see the update, which isn't refused until the
// card's deleted, or the bot's uninstalled
#[test]
fn a_bot_updates_its_card_in_a_groups_thread() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let owner = client::register_user(env, canister_ids);
    let member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), false, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &owner,
        local_user_index,
        group_id,
        vec![(member.user_id, member.principal)],
    );
    let mut definition = default_bot_definition(random_string());
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::MiniApp]));
    definition.autonomous_config = Some(AutonomousConfig {
        permissions: permissions.clone(),
    });
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        definition,
    );
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        permissions.clone(),
        Some(permissions),
    );
    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let chat = Chat::Group(group_id);
    let root = client::group::happy_path::send_text_message(env, &owner, group_id, None, "Who's playing?", None);
    let thread = Some(root.message_index);
    let message_id = random_from_u128();
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread,
            message_id: Some(message_id),
            replies_to: None,
            content: BotMessageContent::MiniApp(card()),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let update = |env: &mut PocketIc| {
        client::local_user_index::bot_update_mini_app(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_update_mini_app::Args {
                chat_context: BotChatContext::Autonomous(chat),
                thread,
                message_id,
                update: MiniAppUpdate {
                    players: Some(vec![owner.user_id, member.user_id]),
                    ..Default::default()
                },
            },
        )
    };

    let since = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let response = update(env);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    env.tick();

    // Members' clients see it as an updated event
    let updates = client::group::happy_path::summary_updates(env, member.principal, group_id, since).unwrap();
    assert!(
        updates
            .updated_events
            .iter()
            .any(|(root, event_index, _)| *root == thread && *event_index == sent.event_index),
        "{:?}",
        updates.updated_events
    );
    let events = client::group::happy_path::thread_events(
        env,
        &member,
        group_id,
        root.message_index,
        EventIndex::default(),
        true,
        10,
        10,
    );
    let card = events
        .events
        .iter()
        .find_map(|e| match &e.event {
            ChatEvent::Message(m) if m.message_id == message_id => match &m.content {
                MessageContent::MiniApp(c) => Some(c.clone()),
                _ => None,
            },
            _ => None,
        })
        .unwrap();
    assert_eq!(card.players, vec![owner.user_id, member.user_id]);

    client::group::happy_path::delete_messages(env, owner.principal, group_id, thread, vec![message_id]);
    let response = update(env);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::MessageNotFound)),
        "Expected MessageNotFound: {response:?}"
    );

    client::local_user_index::happy_path::uninstall_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
    );
    let response = update(env);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "Expected InitiatorNotAuthorized: {response:?}"
    );
}

// That a card can't be forwarded either is in chat_events' unit tests: a member would be refused as
// someone who can't post one at all
#[test]
fn a_member_cant_post_a_mini_app() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        community_id,
        channel_id,
        ..
    } = setup(env, canister_ids, *controller);

    let response = client::community::send_message(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::send_message::Args {
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::MiniApp(card()),
            sender_name: owner.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(&response, community_canister::send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidMessageContent)),
        "Expected InvalidMessageContent: {response:?}"
    );
}

#[test]
fn a_member_gets_a_session_token_for_a_bots_mini_app_message() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    } = setup(env, canister_ids, *controller);
    let (bot_id, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    assert!(is_sent(&response), "'bot_send_message' error: {response:?}");
    tick_many(env, 3);

    let token = match session_token(env, &member, local_user_index, bot_id, chat, None, message_id) {
        access_token_v2::Response::Success(token) => token,
        response => panic!("'access_token_v2' error: {response:?}"),
    };
    let public_key = client::user_index::happy_path::public_key(env, canister_ids.user_index);
    let claims: Claims<BotMessageSessionClaims> =
        verify_and_decode(&token, &public_key, CLAIM_TYPE_BOT_MESSAGE_SESSION).unwrap();
    let now = env.get_time().as_nanos_since_unix_epoch() / 1_000_000;
    assert!(claims.exp_ms() > now + 14 * 60 * 1000 && claims.exp_ms() <= now + 15 * 60 * 1000);
    let claims = claims.into_custom();
    assert_eq!(claims.bot, bot_id);
    assert_eq!(claims.user_id, member.user_id);
    assert_eq!(claims.message_id, message_id);
    assert_eq!(claims.chat, chat);
    assert_eq!(claims.bot_api_gateway, local_user_index);

    // It vouches for the member, so the bot can't act in the chat with it
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(token),
            thread: None,
            message_id: Some(random_from_u128()),
            replies_to: None,
            content: BotMessageContent::Text(TextContent {
                text: "Hello".to_string(),
            }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Error(_)),
        "Expected an error: {response:?}"
    );
}

#[test]
fn a_session_token_is_only_for_members_and_the_bots_mini_app_messages() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    } = setup(env, canister_ids, *controller);
    let (bot_id, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let mini_app_message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, mini_app_message_id, card());
    assert!(is_sent(&response), "'bot_send_message' error: {response:?}");
    // In a private channel the member isn't in
    let private_channel_id =
        client::community::happy_path::create_channel(env, owner.principal, community_id, false, random_string());
    let private_message_id = random_from_u128();
    let response = send(
        env,
        bot_principal,
        local_user_index,
        Chat::Channel(community_id, private_channel_id),
        private_message_id,
        card(),
    );
    assert!(is_sent(&response), "'bot_send_message' error: {response:?}");
    let text_message_id = random_from_u128();
    client::community::happy_path::send_text_message(
        env,
        &owner,
        community_id,
        channel_id,
        None,
        "Hello",
        Some(text_message_id),
    );
    let outsider = client::register_user(env, canister_ids);
    tick_many(env, 3);

    for (user, chat, message_id) in [
        // not a member
        (&outsider, chat, mini_app_message_id),
        // not the bot's message
        (&member, chat, text_message_id),
        // no such message
        (&member, chat, random_from_u128()),
        // not in the channel
        (&member, Chat::Channel(community_id, private_channel_id), private_message_id),
    ] {
        let response = session_token(env, user, local_user_index, bot_id, chat, None, message_id);
        assert!(
            matches!(response, access_token_v2::Response::NotAuthorized),
            "Expected NotAuthorized: {response:?}"
        );
    }
}

#[test]
fn a_group_member_gets_a_session_token_for_a_mini_app_in_a_thread_until_its_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let owner = client::register_user(env, canister_ids);
    let member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), false, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &owner,
        local_user_index,
        group_id,
        vec![(member.user_id, member.principal)],
    );
    let (bot_id, bot_principal) = install_bot_at(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        MessagePermission::MiniApp,
    );
    let root = client::group::happy_path::send_text_message(env, &owner, group_id, None, "Who's playing?", None);
    let thread = Some(root.message_index);
    let message_id = random_from_u128();
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(Chat::Group(group_id)),
            thread,
            message_id: Some(message_id),
            replies_to: None,
            content: BotMessageContent::MiniApp(card()),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    assert!(is_sent(&response), "'bot_send_message' error: {response:?}");
    tick_many(env, 3);

    let chat = Chat::Group(group_id);
    let response = session_token(env, &member, local_user_index, bot_id, chat, thread, message_id);
    assert!(matches!(response, access_token_v2::Response::Success(_)), "{response:?}");
    // The message is in the thread, not the main chat
    let response = session_token(env, &member, local_user_index, bot_id, chat, None, message_id);
    assert!(matches!(response, access_token_v2::Response::NotAuthorized), "{response:?}");

    client::group::happy_path::delete_messages(env, owner.principal, group_id, thread, vec![message_id]);
    let response = session_token(env, &member, local_user_index, bot_id, chat, thread, message_id);
    assert!(matches!(response, access_token_v2::Response::NotAuthorized), "{response:?}");
}

// Once a game closed to spectators has started, only its players get a token for its app
#[test]
fn a_game_closed_to_spectators_opens_only_for_its_players_once_started() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    } = setup(env, canister_ids, *controller);
    let (bot_id, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(
        env,
        bot_principal,
        local_user_index,
        chat,
        message_id,
        MiniAppContent {
            spectators: false,
            ..card()
        },
    );
    assert!(is_sent(&response), "'bot_send_message' error: {response:?}");

    // While it's taking players, anyone may open it, to join
    let response = session_token(env, &member, local_user_index, bot_id, chat, None, message_id);
    assert!(matches!(response, access_token_v2::Response::Success(_)), "{response:?}");

    let response = client::local_user_index::bot_update_mini_app(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_update_mini_app::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id,
            update: MiniAppUpdate {
                status: Some(MiniAppStatus::Active),
                players: Some(vec![owner.user_id]),
                ..Default::default()
            },
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let response = session_token(env, &owner, local_user_index, bot_id, chat, None, message_id);
    assert!(matches!(response, access_token_v2::Response::Success(_)), "{response:?}");
    let response = session_token(env, &member, local_user_index, bot_id, chat, None, message_id);
    assert!(matches!(response, access_token_v2::Response::NotAuthorized), "{response:?}");
}

fn session_token(
    env: &PocketIc,
    user: &User,
    local_user_index: CanisterId,
    bot_id: UserId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
) -> access_token_v2::Response {
    client::local_user_index::access_token_v2(
        env,
        user.principal,
        local_user_index,
        &access_token_v2::Args::BotMessageSession(BotMessageSessionArgs {
            bot_id,
            chat,
            thread,
            message_id,
            meta: None,
        }),
    )
}

fn is_sent(response: &local_user_index_canister::bot_send_message::Response) -> bool {
    matches!(response, local_user_index_canister::bot_send_message::Response::Success(_))
}

struct Setup {
    owner: User,
    member: User,
    community_id: CommunityId,
    channel_id: ChannelId,
    local_user_index: CanisterId,
}

fn setup(env: &mut PocketIc, canister_ids: &crate::CanisterIds, controller: Principal) -> Setup {
    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, controller);
    let member = client::register_user(env, canister_ids);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    client::community::happy_path::join_channel(env, member.principal, community_id, channel_id);
    let local_user_index = canister_ids.local_user_index(env, community_id);
    Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
    }
}

// A bot asking to send text and mini apps autonomously, installed in the community with `granted`
fn install_bot(
    env: &mut PocketIc,
    owner: &User,
    user_index: CanisterId,
    local_user_index: CanisterId,
    community_id: CommunityId,
    granted: MessagePermission,
) -> (UserId, Principal) {
    install_bot_at(
        env,
        owner,
        user_index,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        granted,
    )
}

fn install_bot_at(
    env: &mut PocketIc,
    owner: &User,
    user_index: CanisterId,
    local_user_index: CanisterId,
    location: BotInstallationLocation,
    granted: MessagePermission,
) -> (UserId, Principal) {
    let mut definition = default_bot_definition(random_string());
    definition.autonomous_config = Some(AutonomousConfig {
        permissions: BotPermissions::default()
            .with_message(&HashSet::from_iter([MessagePermission::Text, MessagePermission::MiniApp]))
            .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages])),
    });
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        definition,
    );

    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([granted]));
    let autonomous_permissions = permissions
        .clone()
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        location,
        bot_id,
        permissions,
        Some(autonomous_permissions),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();
    (bot_id, bot_principal)
}

fn send(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    message_id: MessageId,
    content: MiniAppContent,
) -> local_user_index_canister::bot_send_message::Response {
    client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id: Some(message_id),
            replies_to: None,
            content: BotMessageContent::MiniApp(content),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    )
}

// With an image, as if the bot had uploaded one. Nothing here reads the file itself.
fn card() -> MiniAppContent {
    MiniAppContent {
        text: "**Uno** · 2 to 4 players".to_string(),
        image: Some(MiniAppImage {
            width: 600,
            height: 400,
            mime_type: "image/png".to_string(),
            blob_reference: BlobReference {
                canister_id: Principal::from_slice(&[1]),
                blob_id: 7,
            },
        }),
        max_players: Some(4),
        spectators: true,
        spectator_count: 0,
        status: MiniAppStatus::Open,
        players: Vec::new(),
        waiting_for: None,
        result: None,
    }
}

fn card_text(env: &PocketIc, user: &User, community_id: CommunityId, channel_id: ChannelId, event_index: EventIndex) -> String {
    let events = client::community::happy_path::events_by_index(env, user, community_id, channel_id, vec![event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    let MessageContent::MiniApp(content) = &message.content else {
        panic!("Expected a mini app: {:?}", message.content);
    };
    content.text.clone()
}
