use crate::bot_tests::default_bot_definition;
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use jwt::{Claims, verify_and_decode};
use local_user_index_canister::access_token_v2;
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use oc_error_codes::OCErrorCode;
use pocket_ic::{ErrorCode, PocketIc, RejectResponse};
use serde::de::DeserializeOwned;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    AutonomousConfig, BlobReference, BotActionChatDetails, BotActionCommunityDetails, BotActionScope, BotChatContext,
    BotInitiator, BotInstallationLocation, BotMessageContent, BotPermissions, CLAIM_TYPE_MINI_APP_BOT,
    CLAIM_TYPE_MINI_APP_CHAT, CLAIM_TYPE_MINI_APP_POST, CanisterId, ChannelId, Chat, ChatEvent, ChatPermission, CommunityId,
    Empty, EventIndex, MessageContent, MessageContentInitial, MessageId, MessageIndex, MessagePermission, Milliseconds,
    MiniAppActive, MiniAppBotClaims, MiniAppChatClaims, MiniAppContent, MiniAppEnded, MiniAppFinished, MiniAppGame,
    MiniAppImage, MiniAppPostClaims, MiniAppSize, MiniAppStarted, MiniAppStatus, MiniAppStatusUpdate, MiniAppTurn, SuccessOnly,
    UnitResult, UserId,
};

// How long a command's token, and so the post token of a command's card, lasts
const COMMAND_TOKEN_VALIDITY: Milliseconds = 5 * 60 * 1000;

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
        service,
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

    let response = post_card(env, service, bot_principal, local_user_index, chat, None, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    assert_eq!(result.message_id, message_id);
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
        service,
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

    let response = post_card(
        env,
        service,
        bot_principal,
        local_user_index,
        Chat::Channel(community_id, channel_id),
        None,
        random_from_u128(),
        card(),
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "Expected InitiatorNotAuthorized: {response:?}"
    );
}

// Cards are posted through the MiniApp service, so the service knows every game from the moment its
// card exists
#[test]
fn a_bot_cant_post_a_card_itself() {
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
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );
}

// Its status is written only by the MiniApp service, as players join through it
#[test]
fn a_card_is_posted_open() {
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
        service,
    } = setup(env, canister_ids, *controller);
    let (_, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );

    let response = post_card(
        env,
        service,
        bot_principal,
        local_user_index,
        Chat::Channel(community_id, channel_id),
        None,
        random_from_u128(),
        MiniAppContent {
            status: active(vec![member.user_id], Vec::new()),
            ..card()
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidMessageContent)),
        "Expected InvalidMessageContent: {response:?}"
    );
}

// The game starts with its players, its turns pass between them, then it ends with them and its result.
// The message isn't marked as edited, the game starts once, and once it's finished the card never
// changes, though the service can retry a write.
#[test]
fn the_mini_app_service_starts_a_game_then_ends_it() {
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
        service,
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
    let response = post_card(env, service, bot_principal, local_user_index, chat, None, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };

    let write = |env: &mut PocketIc, update: MiniAppStatusUpdate| {
        write_card(env, service, local_user_index, chat, None, message_id, update)
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
    let players = vec![member.user_id, owner.user_id];

    let response = write(env, started(players.clone(), vec![member.user_id]));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let card = read(env);
    assert_eq!(card.status, active(players.clone(), vec![member.user_id]));
    assert_eq!(card.max_players, Some(4));
    assert_eq!(card.text, self::card().text);

    let response = write(env, turn(vec![owner.user_id]));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(read(env).status, active(players.clone(), vec![owner.user_id]));

    let response = write(env, started(vec![member.user_id], Vec::new()));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected the game not to start again: {response:?}"
    );
    let outsider = client::register_user(env, canister_ids);
    let response = write(env, turn(vec![outsider.user_id]));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidMessageContent)),
        "Expected only players to be waited for: {response:?}"
    );
    assert_eq!(read(env).status, active(players.clone(), vec![owner.user_id]));

    let response = write(env, ended(Some("Bob won")));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(read(env).status, finished(players.clone(), Some("Bob won")));

    let response = write(env, ended(Some("Alice won")));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected the finished card not to change: {response:?}"
    );
    let response = write(env, ended(Some("Bob won")));
    assert!(
        matches!(response, UnitResult::Success),
        "Expected a retry to succeed: {response:?}"
    );
    assert_eq!(read(env).status, finished(players, Some("Bob won")));
}

// Not the bot which posted the card, nor a member: so a bot can't list anyone who didn't join
#[test]
fn only_the_mini_app_service_writes_a_card() {
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
        service,
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
    let response = post_card(env, service, bot_principal, local_user_index, chat, None, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    // Once the LocalUserIndex knows the service, so the refusals below aren't for want of one. A turn
    // before the game's started is refused, but by the card, not the LocalUserIndex.
    let response = write_card(env, service, local_user_index, chat, None, message_id, turn(Vec::new()));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    let update = started(vec![member.user_id], Vec::new());
    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        None,
        Some(random_from_u128()),
    );
    for caller in [bot_principal, owner.principal, member.principal] {
        let error = call_update_mini_app(env, caller, local_user_index, chat, None, message_id, update.clone()).unwrap_err();
        assert_eq!(error.error_code, ErrorCode::CanisterRejectedMessage, "{error:?}");
        // Nor does anyone else post a card, even with the bot's token
        let error = call_send_mini_app_message(env, caller, local_user_index, &token, card()).unwrap_err();
        assert_eq!(error.error_code, ErrorCode::CanisterRejectedMessage, "{error:?}");
    }
    let card = client::community::happy_path::events_by_index(env, &member, community_id, channel_id, vec![sent.event_index]);
    let ChatEvent::Message(message) = &card.events[0].event else {
        panic!("Expected a message: {:?}", card.events[0].event);
    };
    assert!(
        matches!(&message.content, MessageContent::MiniApp(c) if c.status == MiniAppStatus::Open),
        "{:?}",
        message.content
    );
}

// In a group too, and in a thread: members' clients see the write. The service's writes are refused
// once the card's deleted, or its bot uninstalled, which ends the game, but for the one finishing it.
#[test]
fn the_mini_app_service_writes_a_card_in_a_groups_thread() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

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
    let service = set_mini_app_service(env, canister_ids, *controller);
    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let chat = Chat::Group(group_id);
    let root = client::group::happy_path::send_text_message(env, &owner, group_id, None, "Who's playing?", None);
    let thread = Some(root.message_index);
    let post = |env: &mut PocketIc| {
        let message_id = random_from_u128();
        let response = post_card(
            env,
            service,
            bot_principal,
            local_user_index,
            chat,
            thread,
            message_id,
            card(),
        );
        let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
            panic!("'send_mini_app_message' error: {response:?}");
        };
        (message_id, sent.event_index)
    };
    let (message_id, event_index) = post(env);
    let (other_message_id, _) = post(env);
    let write = |env: &mut PocketIc, message_id| {
        write_card(
            env,
            service,
            local_user_index,
            chat,
            thread,
            message_id,
            started(vec![owner.user_id, member.user_id], Vec::new()),
        )
    };

    let since = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let response = write(env, message_id);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    env.tick();

    // Members' clients see it as an updated event
    let updates = client::group::happy_path::summary_updates(env, member.principal, group_id, since).unwrap();
    assert!(
        updates
            .updated_events
            .iter()
            .any(|(root, index, _)| *root == thread && *index == event_index),
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
    assert_eq!(card.status, active(vec![owner.user_id, member.user_id], Vec::new()));

    client::group::happy_path::delete_messages(env, owner.principal, group_id, thread, vec![message_id]);
    let response = write(env, message_id);
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
    let response = write(env, other_message_id);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::BotNotFound)),
        "Expected BotNotFound: {response:?}"
    );

    // Then writes the game as finished, so its card doesn't look like it's still being played
    let response = write_card(env, service, local_user_index, chat, thread, other_message_id, ended(None));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
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

// A member may join the chat's games. Someone who can only see the chat, as anyone can a public
// channel in a public community, may watch them. Nobody else gets one.
#[test]
fn a_chat_token_says_whether_the_user_is_a_member() {
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
        ..
    } = setup(env, canister_ids, *controller);
    let outsider = client::register_user(env, canister_ids);
    let private_channel_id =
        client::community::happy_path::create_channel(env, owner.principal, community_id, false, random_string());

    for (user, channel_id, member) in [
        (&member, channel_id, Some(true)),
        (&outsider, channel_id, Some(false)),
        (&member, private_channel_id, None),
        (&outsider, private_channel_id, None),
    ] {
        assert_chat_token(env, canister_ids, user, Chat::Channel(community_id, channel_id), member);
    }
}

// In a group, as for its events: anyone can see a public group, unless it hides its messages from
// non-members, but someone it's blocked can't, and nobody can see a private group they aren't in
#[test]
fn a_chat_token_follows_who_can_see_a_group() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let member = client::register_user(env, canister_ids);
    let outsider = client::register_user(env, canister_ids);
    let blocked = client::register_user(env, canister_ids);
    let public_group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let private_group_id = client::user::happy_path::create_group(env, &owner, &random_string(), false, true);
    let local_user_index = canister_ids.local_user_index(env, public_group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &owner,
        local_user_index,
        public_group_id,
        vec![(member.user_id, member.principal), (blocked.user_id, blocked.principal)],
    );
    client::group::happy_path::block_user(env, owner.principal, public_group_id, blocked.user_id);

    let public_group = Chat::Group(public_group_id);
    for (user, chat, member) in [
        (&member, public_group, Some(true)),
        (&outsider, public_group, Some(false)),
        (&blocked, public_group, None),
        (&outsider, Chat::Group(private_group_id), None),
    ] {
        assert_chat_token(env, canister_ids, user, chat, member);
    }

    client::group::happy_path::update_group(
        env,
        owner.principal,
        public_group_id,
        &group_canister::update_group_v2::Args {
            messages_visible_to_non_members: Some(false),
            ..Default::default()
        },
    );
    assert_chat_token(env, canister_ids, &member, public_group, Some(true));
    assert_chat_token(env, canister_ids, &outsider, public_group, None);
}

// A member of a private community sees its public channels, so may watch the games in one they've left,
// but nobody outside the community can
#[test]
fn a_community_member_watches_a_public_channels_games_without_joining_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let member = client::register_user(env, canister_ids);
    let outsider = client::register_user(env, canister_ids);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), false, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let local_user_index = canister_ids.local_user_index(env, community_id);
    client::local_user_index::happy_path::add_users_to_community(
        env,
        &owner,
        local_user_index,
        community_id,
        vec![(member.user_id, member.principal)],
    );
    // Joining the community put them in its public channels
    client::community::happy_path::leave_channel(env, member.principal, community_id, channel_id);

    let chat = Chat::Channel(community_id, channel_id);
    assert_chat_token(env, canister_ids, &owner, chat, Some(true));
    assert_chat_token(env, canister_ids, &member, chat, Some(false));
    assert_chat_token(env, canister_ids, &outsider, chat, None);
}

// Which bot is calling the MiniApp service. A user can't get one.
#[test]
fn a_bot_gets_a_token_for_the_mini_app_service() {
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
        local_user_index,
        ..
    } = setup(env, canister_ids, *controller);
    let (bot_id, bot_principal) = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );

    let response = client::local_user_index::bot_mini_app_token(env, bot_principal, local_user_index, &Empty {});
    let local_user_index_canister::bot_mini_app_token::Response::Success(token) = response else {
        panic!("'bot_mini_app_token' error: {response:?}");
    };
    let claims: MiniAppBotClaims = verify(env, canister_ids, &token, CLAIM_TYPE_MINI_APP_BOT);
    assert_eq!(claims.bot, bot_id);

    let response = client::local_user_index::bot_mini_app_token(env, member.principal, local_user_index, &Empty {});
    assert!(
        matches!(
            response,
            local_user_index_canister::bot_mini_app_token::Response::NotAuthorized
        ),
        "Expected NotAuthorized: {response:?}"
    );
}

// The token fixes the card's message id, so posting it twice posts one card, and a bot which got no
// answer posts it again. The bot chooses the id, unless a chat command's token fixes it.
#[test]
fn a_bots_post_token_posts_its_card_once() {
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
        service,
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

    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        None,
        Some(message_id),
    );
    let claims: MiniAppPostClaims = verify(env, canister_ids, &token, CLAIM_TYPE_MINI_APP_POST);
    assert_eq!(claims.bot, bot_id);
    assert_eq!(claims.bot_endpoint, "https://my.bot.xyz/");
    assert_eq!(claims.bot_api_gateway, local_user_index);
    assert!(
        claims.game
            == MiniAppGame {
                chat,
                thread: None,
                message_id,
            }
    );
    assert!(matches!(claims.initiator, BotInitiator::Autonomous));

    // The bot chooses an autonomous card's message id: a query can't pick one afresh each time
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_mini_app_post_token::Args {
            chat_context: BotChatContext::Autonomous(chat),
            channel_id: None,
            thread: None,
            message_id: None,
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_mini_app_post_token::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );

    let response = post_with_token(env, service, local_user_index, &token, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    assert_eq!(sent.message_id, message_id);
    // Posting again, as the service does when its first try went unanswered, gives the card the chat
    // holds, not a second card
    let response = post_with_token(env, service, local_user_index, &token, card());
    let local_user_index_canister::bot_send_message::Response::Success(again) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    assert_eq!((again.message_id, again.event_index), (sent.message_id, sent.event_index));
    assert_eq!(
        card_text(env, &member, community_id, channel_id, sent.event_index),
        card().text
    );
    // Any other message at the card's id is taken
    let taken = random_from_u128();
    client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, "Taken", Some(taken));
    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        None,
        Some(taken),
    );
    let response = post_with_token(env, service, local_user_index, &token, card());
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::MessageIdAlreadyExists)),
        "Expected MessageIdAlreadyExists: {response:?}"
    );

    // Only a bot gets one, and never for a direct chat
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        member.principal,
        local_user_index,
        &local_user_index_canister::bot_mini_app_post_token::Args {
            chat_context: BotChatContext::Autonomous(chat),
            channel_id: None,
            thread: None,
            message_id: None,
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_mini_app_post_token::Response::Error(e) if e.matches_code(OCErrorCode::BotNotAuthenticated)),
        "Expected BotNotAuthenticated: {response:?}"
    );
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_mini_app_post_token::Args {
            chat_context: BotChatContext::Autonomous(Chat::Direct(owner.user_id.into())),
            channel_id: None,
            thread: None,
            message_id: Some(random_from_u128()),
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_mini_app_post_token::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );

    // A token lasts an hour
    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        None,
        Some(random_from_u128()),
    );
    env.advance_time(Duration::from_secs(61 * 60));
    env.tick();
    let response = post_with_token(env, service, local_user_index, &token, card());
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::Expired)),
        "Expected Expired: {response:?}"
    );
}

// A member's `/uno` is answered with a card at the command's message id, by the member's leave: the
// command's token fixes the id, and the card holds the command. The card can be posted for as long as
// the command can be answered.
#[test]
fn a_card_answers_a_members_command() {
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
        service,
    } = setup(env, canister_ids, *controller);
    let command_name = random_string();
    let mut definition = default_bot_definition(command_name.clone());
    definition.commands[0].permissions =
        BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::MiniApp]));
    // A command in the community's scope: message permissions aren't granted there, so it asks for none
    let community_command_name = random_string();
    let mut community_command = definition.commands[0].clone();
    community_command.name = community_command_name.clone();
    community_command.permissions = BotPermissions::default();
    definition.commands.push(community_command);
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        definition,
    );
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::MiniApp]));
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions,
        None,
    );
    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = client::local_user_index::access_token_v2(
        env,
        member.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(access_token_v2::BotActionByCommandArgs {
            bot_id,
            command: access_token_v2::BotCommandInitial {
                name: command_name.clone(),
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat,
                thread: None,
                message_id,
                user_message_id: None,
            }),
        }),
    );
    let access_token_v2::Response::Success(command_token) = response else {
        panic!("'access_token_v2' error: {response:?}");
    };

    // Another message id is refused, as the command's is fixed
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_mini_app_post_token::Args {
            chat_context: BotChatContext::Command(command_token.clone()),
            channel_id: None,
            thread: None,
            message_id: Some(random_from_u128()),
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_mini_app_post_token::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );

    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Command(command_token),
        None,
        None,
    );
    let claims: MiniAppPostClaims =
        verify_expiring(env, canister_ids, &token, CLAIM_TYPE_MINI_APP_POST, COMMAND_TOKEN_VALIDITY);
    assert_eq!(claims.game.message_id, message_id);
    assert!(matches!(&claims.initiator, BotInitiator::Command(command) if command.initiator == member.user_id));

    let response = post_with_token(env, service, local_user_index, &token, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    assert_eq!(sent.message_id, message_id);
    tick_many(env, 3);
    let events = client::community::happy_path::events_by_index(env, &member, community_id, channel_id, vec![sent.event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert_eq!(message.sender, bot_id);
    assert!(
        matches!(message.bot_context(), Some(context) if context.command.as_ref().is_some_and(|c| c.initiator == member.user_id)),
        "{:?}",
        message.bot_context()
    );

    // A community command's card goes in the channel the bot names, with a message id the bot chooses
    let response = client::local_user_index::access_token_v2(
        env,
        member.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(access_token_v2::BotActionByCommandArgs {
            bot_id,
            command: access_token_v2::BotCommandInitial {
                name: community_command_name,
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Community(BotActionCommunityDetails { community_id }),
        }),
    );
    let access_token_v2::Response::Success(community_token) = response else {
        panic!("'access_token_v2' error: {response:?}");
    };
    let community_args = |message_id| local_user_index_canister::bot_mini_app_post_token::Args {
        chat_context: BotChatContext::Command(community_token.clone()),
        channel_id: Some(channel_id),
        thread: None,
        message_id,
    };
    let response =
        client::local_user_index::bot_mini_app_post_token(env, bot_principal, local_user_index, &community_args(None));
    assert!(
        matches!(&response, local_user_index_canister::bot_mini_app_post_token::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected InvalidRequest: {response:?}"
    );
    let message_id = random_from_u128();
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        bot_principal,
        local_user_index,
        &community_args(Some(message_id)),
    );
    let local_user_index_canister::bot_mini_app_post_token::Response::Success(token) = response else {
        panic!("'bot_mini_app_post_token' error: {response:?}");
    };
    let claims: MiniAppPostClaims =
        verify_expiring(env, canister_ids, &token, CLAIM_TYPE_MINI_APP_POST, COMMAND_TOKEN_VALIDITY);
    assert_eq!(claims.game.chat, chat);
    assert_eq!(claims.game.message_id, message_id);
    let response = post_with_token(env, service, local_user_index, &token, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'send_mini_app_message' error: {response:?}");
    };
    assert_eq!(sent.message_id, message_id);
}

struct Setup {
    owner: User,
    member: User,
    community_id: CommunityId,
    channel_id: ChannelId,
    local_user_index: CanisterId,
    // The MiniApp service's principal, which the LocalUserIndex learns from the UserIndex
    service: Principal,
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
    let service = set_mini_app_service(env, canister_ids, controller);
    Setup {
        owner,
        member,
        community_id,
        channel_id,
        local_user_index,
        service,
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
    (bot_id, bot_principal)
}

// The bot gets its post token, with the message id it chose, and the MiniApp service posts the card
// with it
#[expect(clippy::too_many_arguments)]
fn post_card(
    env: &mut PocketIc,
    service: Principal,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
    content: MiniAppContent,
) -> local_user_index_canister::bot_send_message::Response {
    let token = post_token(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        thread,
        Some(message_id),
    );
    post_with_token(env, service, local_user_index, &token, content)
}

fn post_token(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat_context: BotChatContext,
    thread: Option<MessageIndex>,
    message_id: Option<MessageId>,
) -> String {
    let response = client::local_user_index::bot_mini_app_post_token(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_mini_app_post_token::Args {
            chat_context,
            channel_id: None,
            thread,
            message_id,
        },
    );
    match response {
        local_user_index_canister::bot_mini_app_post_token::Response::Success(token) => token,
        response => panic!("'bot_mini_app_post_token' error: {response:?}"),
    }
}

// The MiniApp service posting a card, once the LocalUserIndex has learned its principal from the
// UserIndex, which takes a few rounds after it's set
fn post_with_token(
    env: &mut PocketIc,
    service: Principal,
    local_user_index: CanisterId,
    token: &str,
    content: MiniAppContent,
) -> local_user_index_canister::bot_send_message::Response {
    for _ in 0..20 {
        match call_send_mini_app_message(env, service, local_user_index, token, content.clone()) {
            Ok(response) => return response,
            Err(error) if error.error_code == ErrorCode::CanisterRejectedMessage => {
                env.advance_time(Duration::from_millis(100));
                env.tick();
            }
            Err(error) => panic!("'send_mini_app_message' error: {error:?}"),
        }
    }
    panic!("The LocalUserIndex never learned the MiniApp service's principal");
}

// Raw, so a refused caller's rejection can be checked. The LocalUserIndex's inspect_message refuses
// anyone but the service.
fn call_send_mini_app_message(
    env: &mut PocketIc,
    caller: Principal,
    local_user_index: CanisterId,
    token: &str,
    content: MiniAppContent,
) -> Result<local_user_index_canister::bot_send_message::Response, RejectResponse> {
    let args = local_user_index_canister::send_mini_app_message::Args {
        token: token.to_string(),
        content,
        block_level_markdown: false,
        replies_to: None,
    };
    env.update_call(
        local_user_index,
        caller,
        "send_mini_app_message",
        candid::encode_one(&args).unwrap(),
    )
    .map(|bytes| candid::decode_one(&bytes).unwrap())
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
        app_size: MiniAppSize { width: 440, height: 740 },
        status: MiniAppStatus::Open,
    }
}

fn active(players: Vec<UserId>, waiting_for: Vec<UserId>) -> MiniAppStatus {
    MiniAppStatus::Active(MiniAppActive { players, waiting_for })
}

fn finished(players: Vec<UserId>, result: Option<&str>) -> MiniAppStatus {
    MiniAppStatus::Finished(MiniAppFinished {
        players,
        result: result.map(|r| r.to_string()),
    })
}

fn started(players: Vec<UserId>, waiting_for: Vec<UserId>) -> MiniAppStatusUpdate {
    MiniAppStatusUpdate::Started(MiniAppStarted { players, waiting_for })
}

fn turn(waiting_for: Vec<UserId>) -> MiniAppStatusUpdate {
    MiniAppStatusUpdate::Turn(MiniAppTurn { waiting_for })
}

fn ended(result: Option<&str>) -> MiniAppStatusUpdate {
    MiniAppStatusUpdate::Ended(MiniAppEnded {
        result: result.map(|r| r.to_string()),
    })
}

// A new principal for the MiniApp service, set by proposal, which the UserIndex fans out to the
// LocalUserIndexes
fn set_mini_app_service(env: &mut PocketIc, canister_ids: &crate::CanisterIds, controller: Principal) -> Principal {
    let service = random_principal();
    let response = client::user_index::set_mini_app_service_principal(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::set_mini_app_service_principal::Args { principal: service },
    );
    assert!(matches!(response, SuccessOnly::Success));
    service
}

// The MiniApp service updating a card's status, once the LocalUserIndex has learned its principal from
// the UserIndex, which takes a few rounds after it's set
fn write_card(
    env: &mut PocketIc,
    service: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
    update: MiniAppStatusUpdate,
) -> UnitResult {
    for _ in 0..20 {
        match call_update_mini_app(env, service, local_user_index, chat, thread, message_id, update.clone()) {
            Ok(response) => return response,
            Err(error) if error.error_code == ErrorCode::CanisterRejectedMessage => {
                env.advance_time(Duration::from_millis(100));
                env.tick();
            }
            Err(error) => panic!("'update_mini_app' error: {error:?}"),
        }
    }
    panic!("The LocalUserIndex never learned the MiniApp service's principal");
}

// Raw, so a refused caller's rejection can be checked. The LocalUserIndex's inspect_message refuses
// anyone but the service.
fn call_update_mini_app(
    env: &mut PocketIc,
    caller: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
    update: MiniAppStatusUpdate,
) -> Result<UnitResult, RejectResponse> {
    let args = local_user_index_canister::update_mini_app::Args {
        chat,
        thread,
        message_id,
        update,
    };
    env.update_call(
        local_user_index,
        caller,
        "update_mini_app",
        candid::encode_one(&args).unwrap(),
    )
    .map(|bytes| candid::decode_one(&bytes).unwrap())
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

// Signed by OpenChat, with the claim type expected, for an hour
fn verify<T: DeserializeOwned>(env: &mut PocketIc, canister_ids: &crate::CanisterIds, token: &str, claim_type: &str) -> T {
    verify_expiring(env, canister_ids, token, claim_type, 60 * 60 * 1000)
}

// Signed by OpenChat, with the claim type expected, for `validity`
fn verify_expiring<T: DeserializeOwned>(
    env: &mut PocketIc,
    canister_ids: &crate::CanisterIds,
    token: &str,
    claim_type: &str,
    validity: Milliseconds,
) -> T {
    let public_key = client::user_index::happy_path::public_key(env, canister_ids.user_index);
    let claims: Claims<T> = verify_and_decode(token, &public_key, claim_type).unwrap();
    let now = now_millis(env);
    assert!(
        claims.exp_ms() > now + validity - 60 * 1000 && claims.exp_ms() <= now + validity,
        "Expires at {}, now {now}, validity {validity}",
        claims.exp_ms()
    );
    claims.into_custom()
}

// `member` is whether the user's chat token says they're a member, or None if they get none
fn assert_chat_token(env: &mut PocketIc, canister_ids: &crate::CanisterIds, user: &User, chat: Chat, member: Option<bool>) {
    let local_user_index = match chat {
        Chat::Group(chat_id) => canister_ids.local_user_index(env, chat_id),
        Chat::Channel(community_id, _) => canister_ids.local_user_index(env, community_id),
        Chat::Direct(_) => unreachable!(),
    };
    let response = client::local_user_index::access_token_v2(
        env,
        user.principal,
        local_user_index,
        &access_token_v2::Args::MiniAppChat(access_token_v2::MiniAppChatArgs { chat }),
    );
    match (response, member) {
        (access_token_v2::Response::Success(token), Some(member)) => {
            let claims: MiniAppChatClaims = verify(env, canister_ids, &token, CLAIM_TYPE_MINI_APP_CHAT);
            assert_eq!(claims.user_id, user.user_id);
            assert_eq!(claims.chat, chat);
            assert_eq!(claims.member, member, "{chat:?}");
        }
        (access_token_v2::Response::NotAuthorized, None) => {}
        (response, member) => panic!("Expected {member:?} in {chat:?}: {response:?}"),
    }
}
