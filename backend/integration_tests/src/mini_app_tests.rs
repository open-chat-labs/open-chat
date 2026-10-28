use crate::bot_tests::default_bot_definition;
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use oc_error_codes::OCErrorCode;
use pocket_ic::{ErrorCode, PocketIc, RejectResponse};
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    AutonomousConfig, BlobReference, BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId,
    ChannelId, Chat, ChatEvent, ChatPermission, CommunityId, EventIndex, MessageContent, MessageContentInitial, MessageId,
    MessageIndex, MessagePermission, MiniAppActive, MiniAppContent, MiniAppFinished, MiniAppImage, MiniAppStatus, SuccessOnly,
    UnitResult, UserId,
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

// A card is sent whole: only its game's state changes, which the MiniApp service writes
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
    let bot_principal = install_bot(
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
    } = setup(env, canister_ids, *controller);
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );

    let response = send(
        env,
        bot_principal,
        local_user_index,
        Chat::Channel(community_id, channel_id),
        random_from_u128(),
        MiniAppContent {
            status: active(vec![member.user_id]),
            ..card()
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidMessageContent)),
        "Expected InvalidMessageContent: {response:?}"
    );
}

// The game starts with its players, then finishes with them and its result. The message isn't marked
// as edited, its status only moves forward, its players are set when it starts, and once it's finished
// the card never changes, though the service can retry a write.
#[test]
fn the_mini_app_service_starts_then_finishes_a_cards_game() {
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
    let service = set_mini_app_service(env, canister_ids, *controller);
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    let write =
        |env: &mut PocketIc, status: MiniAppStatus| write_card(env, service, local_user_index, chat, None, message_id, status);
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

    let response = write(env, active(players.clone()));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let card = read(env);
    assert_eq!(card.status, active(players.clone()));
    assert_eq!(card.max_players, Some(4));
    assert_eq!(card.text, self::card().text);

    for status in [MiniAppStatus::Open, active(vec![member.user_id])] {
        let response = write(env, status);
        assert!(
            matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
            "Expected InvalidRequest: {response:?}"
        );
    }
    assert_eq!(read(env).status, active(players.clone()));

    let response = write(env, finished(players.clone(), Some("Bob won")));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(read(env).status, finished(players.clone(), Some("Bob won")));

    let response = write(env, finished(players.clone(), Some("Alice won")));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "Expected the finished card not to change: {response:?}"
    );
    let response = write(env, finished(players.clone(), Some("Bob won")));
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
    } = setup(env, canister_ids, *controller);
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::MiniApp,
    );
    let service = set_mini_app_service(env, canister_ids, *controller);
    let chat = Chat::Channel(community_id, channel_id);
    let message_id = random_from_u128();
    let response = send(env, bot_principal, local_user_index, chat, message_id, card());
    let local_user_index_canister::bot_send_message::Response::Success(sent) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    // Once the LocalUserIndex knows the service, so the refusals below aren't for want of one
    let response = write_card(env, service, local_user_index, chat, None, message_id, MiniAppStatus::Open);
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let status = active(vec![member.user_id]);
    for caller in [bot_principal, owner.principal, member.principal] {
        let error = call_update_mini_app(env, caller, local_user_index, chat, None, message_id, status.clone()).unwrap_err();
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
            active(vec![owner.user_id, member.user_id]),
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
    assert_eq!(card.status, active(vec![owner.user_id, member.user_id]));

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
    let response = write_card(
        env,
        service,
        local_user_index,
        chat,
        thread,
        other_message_id,
        finished(Vec::new(), None),
    );
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
        status: MiniAppStatus::Open,
    }
}

fn active(players: Vec<UserId>) -> MiniAppStatus {
    MiniAppStatus::Active(MiniAppActive { players })
}

fn finished(players: Vec<UserId>, result: Option<&str>) -> MiniAppStatus {
    MiniAppStatus::Finished(MiniAppFinished {
        players,
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

// The MiniApp service writing a card's status, once the LocalUserIndex has learned its principal from
// the UserIndex, which takes a few rounds after it's set
fn write_card(
    env: &mut PocketIc,
    service: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
    status: MiniAppStatus,
) -> UnitResult {
    for _ in 0..20 {
        match call_update_mini_app(env, service, local_user_index, chat, thread, message_id, status.clone()) {
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
    status: MiniAppStatus,
) -> Result<UnitResult, RejectResponse> {
    let args = local_user_index_canister::update_mini_app::Args {
        chat,
        thread,
        message_id,
        status,
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
