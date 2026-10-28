use crate::bot_tests::default_bot_definition;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User, client};
use candid::Principal;
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    AutonomousConfig, BlobReference, BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId,
    ChannelId, Chat, ChatEvent, ChatPermission, CommunityId, EventIndex, MessageContent, MessageContentInitial, MessageId,
    MessagePermission, MiniAppContent, MiniAppImage, MiniAppStatus, MiniAppUpdate, OptionUpdate, UnitResult,
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
    let bot_principal = install_bot(
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
    let bot_principal = install_bot(
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

// A bot can replace a message it hasn't finished sending, eg. a "Thinking ..." placeholder, but not a
// card, which never changes
#[test]
fn a_bot_cant_replace_a_card_it_hasnt_finished_sending() {
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
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let send = |env: &mut PocketIc, content: BotMessageContent, finalised: bool| {
        client::local_user_index::bot_send_message(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_send_message::Args {
                chat_context: BotChatContext::Autonomous(chat),
                thread: None,
                message_id: Some(message_id),
                replies_to: None,
                content,
                block_level_markdown: false,
                finalised,
                og_previews: None,
                bridged_from: None,
            },
        )
    };

    let response = send(env, BotMessageContent::MiniApp(card()), false);
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    let response = send(
        env,
        BotMessageContent::MiniApp(MiniAppContent {
            text: "**Uno** · game over".to_string(),
            ..card()
        }),
        true,
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidMessageType)),
        "Expected the card not to change: {response:?}"
    );
    tick_many(env, 3);
    assert_eq!(
        card_text(env, &member, community_id, channel_id, result.event_index),
        card().text
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
    let bot_principal = install_bot(
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
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let other_bot_principal = install_bot(
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
) -> Principal {
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
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions,
        Some(autonomous_permissions),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();
    bot_principal
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
