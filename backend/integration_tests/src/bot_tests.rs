use crate::client::INIT_CYCLES_BALANCE;
use crate::env::ENV;
use crate::utils::{metrics, now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use community_canister::c2c_bot_community_events::{
    EventsByIndexArgs as CommunityEventsByIndexArgs, EventsSelectionCriteria as CommunityEventsSelectionCriteria,
};
use community_canister::community_events::EventsPageArgs;
use constants::MINUTE_IN_MS;
use local_user_index_canister::access_token_v2::{self, BotActionByCommandArgs, BotCommandInitial};
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use multi_user_canister::MessageActivity;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    AutonomousConfig, BlobReference, BotActionChatDetails, BotActionScope, BotChatContext, BotChatEvent, BotCommandArg,
    BotCommandArgValue, BotCommandDefinition, BotCommandParam, BotCommandParamType, BotDataEncoding, BotDefinition, BotEvent,
    BotEventWrapper, BotInstallationLocation, BotMessageContent, BotPermissions, BotSubscriptions, BridgePlatform, CanisterId,
    ChannelId, Chat, ChatEvent, ChatEventType, ChatPermission, ChatType, CommunityEventType, CommunityPermission, EventIndex,
    GroupReplyContext, HttpRequest, ImageContent, MessageContent, MessageContentInitial, MessageId, MessageIndex,
    MessagePermission, NotificationEnvelope, OptionUpdate, Rules, StringParam, TextContent, ThumbnailData, UpdatedRules,
    UserId,
};

#[test]
fn e2e_command_bot_test() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    let initial_time = now_millis(env);
    println!("initial_time: {initial_time}");

    // Confirm bot returned in `bot_updates`
    let response = client::user_index::happy_path::bot_updates(env, owner.principal, canister_ids.user_index, start);
    assert_eq!(response.added_or_updated.len(), 1);

    let bot = &response.added_or_updated[0];
    assert_eq!(bot.id, bot_id);
    assert_eq!(bot.name, bot_name);

    // Add bot to group with inadequate permissions
    let mut granted_permissions = BotPermissions::default();
    let installation_location = BotInstallationLocation::Group(group_id);
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        installation_location,
        bot.id,
        granted_permissions.clone(),
        None,
    );

    // Explore bots and check new bot is returned
    let response = client::user_index::happy_path::explore_bots(
        env,
        owner.principal,
        canister_ids.user_index,
        None,
        Some(installation_location),
    );
    assert!(response.matches.iter().any(|b| b.id == bot_id));

    let bot_added_timestamp = now_millis(env);
    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Confirm bot returned in `selected_initial`
    let response = client::group::happy_path::selected_initial(env, owner.principal, group_id);
    assert_eq!(response.bots.len(), 1);
    assert_eq!(response.bots[0].user_id, bot.id);

    // Get an access token to call the greet command
    let chat = Chat::Group(group_id);
    let message_id = random_from_u128();
    let access_token_args = access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
        bot_id,
        command: BotCommandInitial {
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
    });

    let response = client::local_user_index::access_token_v2(env, owner.principal, local_user_index, &access_token_args);

    // Confirm bot is unauthorised
    assert!(matches!(
        response,
        local_user_index_canister::access_token_v2::Response::NotAuthorized
    ));

    // Update the group bot permissions
    granted_permissions = granted_permissions.with_message(&HashSet::from_iter([MessagePermission::Text]));
    client::group::happy_path::update_bot(env, owner.principal, group_id, bot.id, granted_permissions.clone());

    // Confirm bot returned in `selected_update`
    let response = client::group::happy_path::selected_updates(env, owner.principal, group_id, bot_added_timestamp)
        .expect("Expected `selected_updates`");
    assert_eq!(response.bots_added_or_updated.len(), 1);
    assert_eq!(response.bots_added_or_updated[0].user_id, bot.id);

    // Try again to get an access token to call the greet command
    let access_token =
        match client::local_user_index::access_token_v2(env, owner.principal, local_user_index, &access_token_args) {
            local_user_index_canister::access_token_v2::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };

    println!("ACCESS TOKEN: {access_token}");

    // Call execute_bot_action as bot - unfinalised message
    let username = owner.username();
    let text = format!("Hello {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Call `events` and confirm the latest event is a text message from the bot
    let response = client::group::happy_path::events(env, &owner, group_id, 0.into(), true, 5, 10);

    let latest_event = response.events.last().expect("Expected some channel events");
    let ChatEvent::Message(message) = &latest_event.event else {
        panic!("Expected latest event to be a message: {latest_event:?}");
    };
    let MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(text_content.text, text);
    assert!(!message.edited);
    assert!(message.bot_context().is_some());
    assert!(!message.bot_context().as_ref().unwrap().finalised);

    // Call execute_bot_action as bot - finalised message
    let text = "Hello world".to_string();

    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Call `events` and confirm the latest event is a text message from the bot
    let response = client::group::happy_path::events(env, &owner, group_id, 0.into(), true, 5, 10);

    let latest_event = response.events.last().expect("Expected some channel events");
    let ChatEvent::Message(message) = &latest_event.event else {
        panic!("Expected latest event to be a message: {latest_event:?}");
    };
    let MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(text_content.text, text);

    assert!(message.edited);
    assert!(message.bot_context().is_some());
    assert!(message.bot_context().as_ref().unwrap().finalised);

    // Update the bot endpoint
    let new_endpoint = "https://123.bot.xyz/".to_string();
    client::user_index::happy_path::update_bot(
        env,
        canister_ids.user_index,
        owner.principal,
        bot.id,
        None,
        None,
        Some(new_endpoint.clone()),
        None,
    );

    // Confirm bot returned in `bot_updates`
    let response =
        client::user_index::happy_path::bot_updates(env, owner.principal, canister_ids.user_index, bot_added_timestamp);
    assert_eq!(response.added_or_updated.len(), 1);

    let bot = &response.added_or_updated[0];
    assert_eq!(bot.endpoint, new_endpoint);
}

#[test]
fn user_who_used_command_can_delete_bots_response() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let initiator = client::register_user(env, canister_ids);
    let other_member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    client::group::happy_path::join_group(env, initiator.principal, group_id);
    client::group::happy_path::join_group(env, other_member.principal, group_id);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), command_name.clone());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::text_only(),
        None,
    );

    // The bot responds to a command used by a member who can't delete other users' messages
    let message_id = random_from_u128();
    let access_token = match client::local_user_index::access_token_v2(
        env,
        initiator.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
            bot_id,
            command: BotCommandInitial {
                name: command_name,
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat: Chat::Group(group_id),
                thread: None,
                message_id,
                user_message_id: None,
            }),
        }),
    ) {
        access_token_v2::Response::Success(access_token) => access_token,
        response => panic!("'access_token' error: {response:?}"),
    };
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token),
            thread: None,
            message_id: None,
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
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    let content = |env: &PocketIc| {
        let response = client::group::happy_path::events_by_index(env, &owner, group_id, vec![result.event_index]);
        let Some(ChatEvent::Message(message)) = response.events.first().map(|e| &e.event) else {
            panic!("Unexpected response from `events_by_index`: {response:?}");
        };
        message.content.clone()
    };

    // Another member can't delete it
    client::group::happy_path::delete_messages(env, other_member.principal, group_id, None, vec![message_id]);
    assert!(matches!(content(env), MessageContent::Text(_)));

    // The member who used the command can
    client::group::happy_path::delete_messages(env, initiator.principal, group_id, None, vec![message_id]);
    assert!(matches!(
        content(env),
        MessageContent::Deleted(d) if d.deleted_by == initiator.user_id
    ));

    // As when an admin deletes someone else's message, its content is kept after the 5 minutes in which
    // a sender's own deleted message can be undeleted. They can see it and undelete it.
    env.advance_time(Duration::from_millis(6 * MINUTE_IN_MS));
    tick_many(env, 3);
    let response = client::group::deleted_message(
        env,
        initiator.principal,
        group_id.into(),
        &group_canister::deleted_message::Args {
            thread_root_message_index: None,
            message_id,
        },
    );
    assert!(
        matches!(response, group_canister::deleted_message::Response::Success(_)),
        "{response:?}"
    );
    let response = client::group::undelete_messages(
        env,
        initiator.principal,
        group_id.into(),
        &group_canister::undelete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(
        matches!(&response, group_canister::undelete_messages::Response::Success(r) if r.messages.len() == 1),
        "{response:?}"
    );
    assert!(matches!(content(env), MessageContent::Text(_)));
}

// A reply to a bot's response to a command is for whoever used the command, as the bot's own later
// reply is, eg. an alert they set, in the chat or in a thread
#[test]
fn replies_to_bots_response_are_for_user_who_used_command() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let initiator = client::register_user(env, canister_ids);
    let other_member = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    client::group::happy_path::join_group(env, initiator.principal, group_id);
    client::group::happy_path::join_group(env, other_member.principal, group_id);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), command_name.clone());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::text_only()),
    );

    // The initiator uses the command, in the chat or in a thread, and the bot responds
    let respond_to_command = |env: &mut PocketIc, thread: Option<MessageIndex>| {
        let access_token = match client::local_user_index::access_token_v2(
            env,
            initiator.principal,
            local_user_index,
            &access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
                bot_id,
                command: BotCommandInitial {
                    name: command_name.clone(),
                    args: Vec::new(),
                    meta: None,
                },
                scope: BotActionScope::Chat(BotActionChatDetails {
                    chat: Chat::Group(group_id),
                    thread,
                    message_id: random_from_u128(),
                    user_message_id: None,
                }),
            }),
        ) {
            access_token_v2::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };
        bot_send_message(
            env,
            bot_principal,
            local_user_index,
            BotChatContext::Command(access_token),
            None,
            None,
        )
    };
    // The bot replies on its own, later
    let bot_replies = |env: &mut PocketIc, thread: Option<MessageIndex>, replies_to: EventIndex| {
        bot_send_message(
            env,
            bot_principal,
            local_user_index,
            BotChatContext::Autonomous(Chat::Group(group_id)),
            thread,
            Some(replies_to),
        )
        .message_id
    };
    let member_replies = |env: &mut PocketIc, thread: Option<MessageIndex>, replies_to: Option<EventIndex>| {
        let message_id = random_from_u128();
        client::group::happy_path::send_message(
            env,
            &other_member,
            group_id,
            thread,
            MessageContentInitial::Text(TextContent { text: random_string() }),
            replies_to.map(|event_index| GroupReplyContext { event_index }),
            Some(message_id),
        );
        message_id
    };
    let mentioned = |env: &PocketIc, message_id: MessageId| {
        client::group::happy_path::summary(env, initiator.principal, group_id)
            .membership
            .unwrap()
            .mentions
            .iter()
            .any(|m| m.message_id == message_id)
    };

    // In the chat, a member's reply to the response mentions the initiator and makes them activity
    let response = respond_to_command(env, None);
    let reply_id = member_replies(env, None, Some(response.event_index));
    assert!(mentioned(env, reply_id));
    wait_for_activity(env, &initiator, MessageActivity::QuoteReply, reply_id, other_member.user_id);

    // As does the bot's own reply, to its mention
    let bots_reply_id = bot_replies(env, None, response.event_index);
    assert!(mentioned(env, bots_reply_id));

    // A thread started on the response is for the initiator, who follows it
    let thread_reply_id = member_replies(env, Some(response.message_index), None);
    assert!(mentioned(env, thread_reply_id));

    // A response in a thread the initiator hasn't posted in makes them follow it, so the bot's reply
    // to the response reaches them
    let root_message_index =
        client::group::happy_path::send_text_message(env, &owner, group_id, None, random_string(), None).message_index;
    let response_in_thread = respond_to_command(env, Some(root_message_index));
    let bots_reply_in_thread_id = bot_replies(env, Some(root_message_index), response_in_thread.event_index);
    assert!(mentioned(env, bots_reply_in_thread_id));

    // Once the initiator has deleted a response, the bot's reply to it is for no one
    let deleted_response = respond_to_command(env, None);
    client::group::happy_path::delete_messages(env, initiator.principal, group_id, None, vec![deleted_response.message_id]);
    let bots_reply_to_deleted_id = bot_replies(env, None, deleted_response.event_index);
    assert!(!mentioned(env, bots_reply_to_deleted_id));
}

// Any bot can edit its own messages, autonomously, eg. to strike out a command's response that no
// longer holds
#[test]
fn bots_edit_their_own_messages_autonomously() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), command_name.clone());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::text_only()),
    );

    let access_token = match client::local_user_index::access_token_v2(
        env,
        owner.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
            bot_id,
            command: BotCommandInitial {
                name: command_name,
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat: Chat::Group(group_id),
                thread: None,
                message_id: random_from_u128(),
                user_message_id: None,
            }),
        }),
    ) {
        access_token_v2::Response::Success(access_token) => access_token,
        response => panic!("'access_token' error: {response:?}"),
    };
    let response = bot_send_message(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Command(access_token.clone()),
        None,
        None,
    );

    let edit = |env: &mut PocketIc, chat_context: BotChatContext, message_id: MessageId, text: &str| {
        client::local_user_index::bot_edit_message(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_edit_message::Args {
                chat_context,
                thread: None,
                message_id,
                content: BotMessageContent::Text(TextContent { text: text.to_string() }),
                block_level_markdown: false,
                og_previews: None,
            },
        )
    };
    let text_of = |env: &PocketIc, event_index: EventIndex| {
        let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![event_index]);
        let ChatEvent::Message(message) = &events.events[0].event else {
            panic!("Expected a message: {:?}", events.events[0].event);
        };
        let MessageContent::Text(text) = &message.content else {
            panic!("Expected text: {:?}", message.content);
        };
        (text.text.clone(), message.edited)
    };

    // The bot edits its response to the command
    let result = edit(
        env,
        BotChatContext::Autonomous(Chat::Group(group_id)),
        response.message_id,
        "~~Struck out~~",
    );
    assert!(matches!(result, types::UnitResult::Success), "{result:?}");
    assert_eq!(text_of(env, response.event_index), ("~~Struck out~~".to_string(), true));

    // But not with the command's access token
    let result = edit(
        env,
        BotChatContext::Command(access_token),
        response.message_id,
        "Edited by command",
    );
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{result:?}"
    );

    // Nor someone else's message
    let text = random_string();
    let members_message_id = random_from_u128();
    let members_message =
        client::group::happy_path::send_text_message(env, &owner, group_id, None, &text, Some(members_message_id));
    let result = edit(
        env,
        BotChatContext::Autonomous(Chat::Group(group_id)),
        members_message_id,
        "Edited by the bot",
    );
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{result:?}"
    );
    assert_eq!(text_of(env, members_message.event_index), (text, false));

    // Nor its own once it's uninstalled, which only the group checks
    client::local_user_index::happy_path::uninstall_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
    );
    let result = edit(
        env,
        BotChatContext::Autonomous(Chat::Group(group_id)),
        response.message_id,
        "Edited once uninstalled",
    );
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{result:?}"
    );
    assert_eq!(text_of(env, response.event_index), ("~~Struck out~~".to_string(), true));
}

// A bot can replace the "Thinking ..." placeholder it's still sending with what it made, but once
// that's sent, an edit only changes the text, as a user's does
#[test]
fn a_bot_replaces_its_placeholder_but_its_edits_only_change_the_text() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    let command_name = random_string();
    let text_and_images =
        BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text, MessagePermission::Image]));
    let mut definition = default_bot_definition(command_name.clone());
    definition.commands[0].permissions = text_and_images.clone();
    definition.autonomous_config = Some(AutonomousConfig {
        permissions: text_and_images.clone(),
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
        text_and_images.clone(),
        Some(text_and_images),
    );

    let access_token = match client::local_user_index::access_token_v2(
        env,
        owner.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
            bot_id,
            command: BotCommandInitial {
                name: command_name,
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat: Chat::Group(group_id),
                thread: None,
                message_id: random_from_u128(),
                user_message_id: None,
            }),
        }),
    ) {
        access_token_v2::Response::Success(access_token) => access_token,
        response => panic!("'access_token' error: {response:?}"),
    };

    let send =
        |env: &mut PocketIc, content: BotMessageContent, finalised: bool| match client::local_user_index::bot_send_message(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_send_message::Args {
                chat_context: BotChatContext::Command(access_token.clone()),
                thread: None,
                message_id: None,
                replies_to: None,
                content,
                block_level_markdown: false,
                finalised,
                og_previews: None,
                bridged_from: None,
            },
        ) {
            local_user_index_canister::bot_send_message::Response::Success(result) => result,
            response => panic!("'bot_send_message' error: {response:?}"),
        };
    let image = |caption: &str, blob_id: u128| {
        BotMessageContent::Image(ImageContent {
            width: 100,
            height: 100,
            thumbnail_data: ThumbnailData("data:image/jpeg;base64,".to_string()),
            caption: Some(caption.to_string()),
            mime_type: "image/jpeg".to_string(),
            blob_reference: Some(BlobReference {
                canister_id: Principal::from_slice(&[1]),
                blob_id,
            }),
        })
    };
    let image_of = |env: &PocketIc, event_index: EventIndex| {
        let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![event_index]);
        let ChatEvent::Message(message) = &events.events[0].event else {
            panic!("Expected a message: {:?}", events.events[0].event);
        };
        let MessageContent::Image(image) = &message.content else {
            panic!("Expected an image: {:?}", message.content);
        };
        (image.caption.clone(), image.blob_reference.as_ref().map(|b| b.blob_id))
    };

    send(
        env,
        BotMessageContent::Text(TextContent {
            text: "Thinking ...".to_string(),
        }),
        false,
    );
    let sent = send(env, image("A cat", 7), true);
    assert_eq!(image_of(env, sent.event_index), (Some("A cat".to_string()), Some(7)));

    let result = client::local_user_index::bot_edit_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_edit_message::Args {
            chat_context: BotChatContext::Autonomous(Chat::Group(group_id)),
            thread: None,
            message_id: sent.message_id,
            content: image("A dog", 8),
            block_level_markdown: false,
            og_previews: None,
        },
    );
    assert!(matches!(result, types::UnitResult::Success), "{result:?}");
    assert_eq!(image_of(env, sent.event_index), (Some("A dog".to_string()), Some(7)));
}

// Any bot can delete its own messages autonomously, as it can edit them, without the DeleteMessages
// permission
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn bots_delete_their_own_messages_autonomously(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let chat = match chat_type {
        ChatType::Group => Chat::Group(client::user::happy_path::create_group(
            env,
            &owner,
            &random_string(),
            true,
            true,
        )),
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            Chat::Channel(community_id, channel_id)
        }
        ChatType::Direct => unreachable!(),
    };
    let local_user_index = canister_ids.local_user_index(env, chat.canister_id());

    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), command_name.clone());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        chat.into(),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::text_only()),
    );

    let access_token = match client::local_user_index::access_token_v2(
        env,
        owner.principal,
        local_user_index,
        &access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
            bot_id,
            command: BotCommandInitial {
                name: command_name,
                args: Vec::new(),
                meta: None,
            },
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat,
                thread: None,
                message_id: random_from_u128(),
                user_message_id: None,
            }),
        }),
    ) {
        access_token_v2::Response::Success(access_token) => access_token,
        response => panic!("'access_token' error: {response:?}"),
    };
    let response = bot_send_message(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Command(access_token.clone()),
        None,
        None,
    );

    let delete = |env: &mut PocketIc, chat_context: BotChatContext, message_ids: Vec<MessageId>| {
        client::local_user_index::bot_delete_messages(
            env,
            bot_principal,
            local_user_index,
            &local_user_index_canister::bot_delete_messages::Args {
                chat_context,
                thread: None,
                message_ids,
            },
        )
    };
    let deleted_by = |env: &PocketIc, event_index: EventIndex| {
        let events = match chat {
            Chat::Group(group_id) => client::group::happy_path::events_by_index(env, &owner, group_id, vec![event_index]),
            Chat::Channel(community_id, channel_id) => {
                client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![event_index])
            }
            Chat::Direct(_) => unreachable!(),
        };
        let ChatEvent::Message(message) = &events.events[0].event else {
            panic!("Expected a message: {:?}", events.events[0].event);
        };
        match &message.content {
            MessageContent::Deleted(deleted_by) => Some(deleted_by.deleted_by),
            _ => None,
        }
    };

    // The bot can't delete its response with the command's access token, lacking the permission
    let result = delete(env, BotChatContext::Command(access_token), vec![response.message_id]);
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{result:?}"
    );
    assert_eq!(deleted_by(env, response.event_index), None);

    // Nor someone else's message autonomously, which stops it deleting its own alongside
    let members_message_id = random_from_u128();
    let members_message_event_index = match chat {
        Chat::Group(group_id) => {
            client::group::happy_path::send_text_message(env, &owner, group_id, None, random_string(), Some(members_message_id))
                .event_index
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_text_message(
                env,
                &owner,
                community_id,
                channel_id,
                None,
                random_string(),
                Some(members_message_id),
            )
            .event_index
        }
        Chat::Direct(_) => unreachable!(),
    };
    let result = delete(
        env,
        BotChatContext::Autonomous(chat),
        vec![response.message_id, members_message_id],
    );
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{result:?}"
    );
    assert_eq!(deleted_by(env, response.event_index), None);
    assert_eq!(deleted_by(env, members_message_event_index), None);

    // But it deletes its own autonomously
    let result = delete(env, BotChatContext::Autonomous(chat), vec![response.message_id]);
    assert!(matches!(result, types::UnitResult::Success), "{result:?}");
    assert_eq!(deleted_by(env, response.event_index), Some(bot_id));

    // Though not once it's uninstalled, which only the group or community checks
    let autonomous_message = bot_send_message(
        env,
        bot_principal,
        local_user_index,
        BotChatContext::Autonomous(chat),
        None,
        None,
    );
    client::local_user_index::happy_path::uninstall_bot(env, owner.principal, local_user_index, chat.into(), bot_id);
    let result = delete(env, BotChatContext::Autonomous(chat), vec![autonomous_message.message_id]);
    assert!(
        matches!(&result, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{result:?}"
    );
    assert_eq!(deleted_by(env, autonomous_message.event_index), None);
}

fn bot_send_message(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat_context: BotChatContext,
    thread: Option<MessageIndex>,
    replies_to: Option<EventIndex>,
) -> local_user_index_canister::bot_send_message::SuccessResult {
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context,
            thread,
            message_id: None,
            replies_to,
            content: BotMessageContent::Text(TextContent { text: random_string() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    match response {
        local_user_index_canister::bot_send_message::Response::Success(result) => result,
        response => panic!("'bot_send_message' error: {response:?}"),
    }
}

fn wait_for_activity(env: &mut PocketIc, user: &User, activity: MessageActivity, message_id: MessageId, by: UserId) {
    for _ in 0..20 {
        if client::user::happy_path::message_activity_feed(env, user, 0)
            .events
            .iter()
            .any(|e| e.activity == activity && e.message_id == message_id && e.user_id == Some(by))
        {
            return;
        }
        env.tick();
    }
    panic!(
        "{activity:?} activity on {message_id:?} by {by} never reached {}",
        user.user_id
    );
}

#[test]
fn remove_bot_test() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, _) = register_bot(env, &user, canister_ids.user_index, bot_name, command_name);

    tick_many(env, 3);

    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        canister_ids.local_user_index(env, group_id),
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::default(),
        None,
    );

    let bot_installed_timestamp = now_millis(env);
    env.advance_time(Duration::from_millis(1000));
    tick_many(env, 3);

    client::user_index::happy_path::remove_bot(env, user.principal, canister_ids.user_index, bot_id);

    tick_many(env, 5);

    let updates = client::user_index::happy_path::bot_updates(env, user.principal, canister_ids.user_index, start);
    assert_eq!(updates.removed, vec![bot_id]);

    let response = client::group::happy_path::selected_updates(env, user.principal, group_id, bot_installed_timestamp)
        .expect("Expected `selected_updates`");
    assert_eq!(response.bots_removed.len(), 1);
    assert_eq!(response.bots_removed[0], bot_id);
}

// The location canister is called by its id alone, so a user's direct chat accepts an install under
// any variant. Were that recorded, the UserIndex would later route the installation's events into
// the group or community event queues, where they could never be delivered.
#[test]
fn install_bot_rejects_location_of_wrong_type() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let other_user = client::register_user(env, canister_ids);
    let (bot_id, _) = register_bot(env, &user, canister_ids.user_index, random_string(), random_string());
    let local_user_index = canister_ids.local_user_index(env, user.user_id.canister_id());

    tick_many(env, 3);

    let wrong_locations = [
        BotInstallationLocation::Group(user.user_id.into()),
        BotInstallationLocation::Community(user.user_id.as_principal().into()),
        BotInstallationLocation::User(other_user.user_id.into()),
    ];

    for location in wrong_locations {
        let expected_code = || match location {
            BotInstallationLocation::Group(_) => OCErrorCode::ChatNotFound,
            BotInstallationLocation::Community(_) => OCErrorCode::CommunityNotFound,
            BotInstallationLocation::User(_) => OCErrorCode::InitiatorNotAuthorized,
        };

        let response = client::local_user_index::install_bot(
            env,
            user.principal,
            local_user_index,
            &local_user_index_canister::install_bot::Args {
                location,
                bot_id,
                granted_permissions: BotPermissions::text_only(),
                granted_autonomous_permissions: None,
            },
        );
        assert!(
            matches!(&response, local_user_index_canister::install_bot::Response::Error(e) if e.matches_code(expected_code())),
            "{location:?}: {response:?}"
        );

        let response = client::local_user_index::uninstall_bot(
            env,
            user.principal,
            local_user_index,
            &local_user_index_canister::uninstall_bot::Args { location, bot_id },
        );
        assert!(
            matches!(&response, local_user_index_canister::uninstall_bot::Response::Error(e) if e.matches_code(expected_code())),
            "{location:?}: {response:?}"
        );
    }

    client::local_user_index::happy_path::install_bot(
        env,
        user.principal,
        local_user_index,
        BotInstallationLocation::User(user.user_id.into()),
        bot_id,
        BotPermissions::text_only(),
        None,
    );
}

#[test]
fn e2e_autonomous_bot_test() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let chat = Chat::Channel(community_id, channel_id);

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    let permissions = BotPermissions::default()
        .with_message(&HashSet::from_iter([MessagePermission::Text]))
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));

    // Add bot to community
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, community_id),
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions.clone(),
        Some(permissions.clone()),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let latest_notification_index_at_start = client::local_user_index::happy_path::latest_notification_index(
        env,
        *controller,
        canister_ids.local_user_index(env, community_id),
    );

    // Call bot_send_message
    let text = "Hello world".to_string();
    let send_message_response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    assert!(
        matches!(
            send_message_response,
            local_user_index_canister::bot_send_message::Response::Success(_)
        ),
        "'bot_send_message' error: {send_message_response:?}"
    );

    tick_many(env, 5);

    let notifications = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        canister_ids.local_user_index(env, community_id),
        latest_notification_index_at_start + 1,
    );

    assert!(notifications.bot_endpoints.contains_key(&bot_id));
    let (index, envelope) = notifications
        .notifications
        .iter()
        .find_map(|n| match &n.value {
            NotificationEnvelope::Bot(b) if b.recipients.contains_key(&bot_id) => Some((n.index, b)),
            _ => None,
        })
        .expect("No notification for the bot");

    // The signed payload carries the notification's index, so a bot can drop one sent again
    let event_wrapper: BotEventWrapper = msgpack::deserialize_then_unwrap(&envelope.event_map[&BotDataEncoding::MsgPack].data);
    assert_eq!(event_wrapper.notification_index, index);
}

#[test]
fn create_channel_autonomously() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let local_user_index = canister_ids.local_user_index(env, community_id);

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    // Add bot to community
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::from_community_permission(
            CommunityPermission::CreatePublicChannel,
        )),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // The bot creates a channel
    let response = client::local_user_index::bot_create_channel(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_create_channel::Args {
            community_id,
            is_public: true,
            name: "My channel".to_string(),
            description: "For stuff".to_string(),
            rules: Rules {
                text: "Some rules".to_string(),
                enabled: false,
            },
            avatar: None,
            history_visible_to_new_joiners: true,
            messages_visible_to_non_members: true,
            permissions: None,
            events_ttl: None,
            gate_config: None,
            external_url: None,
        },
    );

    let local_user_index_canister::bot_create_channel::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    // Bot sends a message to the channel
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(Chat::Channel(community_id, result.channel_id)),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent {
                text: "I'm sorry, Dave. I'm afraid I can't do that.".to_string(),
            }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Bot removes the channel
    let response = client::local_user_index::bot_delete_channel(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_delete_channel::Args {
            community_id,
            channel_id: result.channel_id,
        },
    );

    if !matches!(response, local_user_index_canister::bot_delete_channel::Response::Success) {
        panic!("'bot_delete_channel' error: {response:?}");
    }
}

#[test_case(true)]
#[test_case(false)]
fn read_messages_autonomously(authorized: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let chat = Chat::Channel(community_id, channel_id);

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, community_id),
        BotInstallationLocation::Community(community_id),
        bot_id,
        BotPermissions::text_only(),
        Some(BotPermissions::default().with_chat(&HashSet::from_iter([if authorized {
            ChatPermission::ReadMessages
        } else {
            ChatPermission::ReadMembership
        }]))),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let send_message_response =
        client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, random_string(), None);

    let response = client::local_user_index::bot_chat_events(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::bot_chat_events::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            events: EventsSelectionCriteria::ByIndex(EventsByIndexArgs {
                events: vec![send_message_response.event_index],
            }),
        },
    );

    let local_user_index_canister::bot_chat_events::Response::Success(result) = &response else {
        panic!("'bot_chat_events' error: {response:?}");
    };

    if authorized {
        assert_eq!(result.events.len(), 1);
        assert!(result.unauthorized.is_empty());
    } else {
        assert!(result.events.is_empty());
        assert_eq!(result.unauthorized, vec![send_message_response.event_index]);
    }
}

#[test]
fn read_messages_by_command() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let endpoint = "https://my.bot.xyz/".to_string();
    let description = "greet".to_string();

    let commands = vec![BotCommandDefinition {
        name: command_name.clone(),
        description: Some("Hello {user}".to_string()),
        placeholder: None,
        params: vec![],
        permissions: BotPermissions::from_chat_permission(ChatPermission::ReadMessages),
        default_role: None,
        direct_messages: None,
    }];

    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        bot_name.clone(),
        endpoint.clone(),
        BotDefinition {
            description: description.clone(),
            commands: commands.clone(),
            autonomous_config: Some(AutonomousConfig {
                permissions: BotPermissions::default(),
            }),
            default_subscriptions: None,
            data_encoding: None,
            restricted_locations: None,
        },
    );

    let chat = Chat::Channel(community_id, channel_id);
    let local_user_index = canister_ids.local_user_index(env, chat.canister_id());

    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        BotPermissions::from_chat_permission(ChatPermission::ReadMessages),
        None,
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let message_id = random_from_u128();
    let access_token_args = access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
        bot_id,
        command: BotCommandInitial {
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
    });

    let access_token =
        match client::local_user_index::access_token_v2(env, owner.principal, local_user_index, &access_token_args) {
            local_user_index_canister::access_token_v2::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };

    let send_message_response =
        client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, random_string(), None);

    let response = client::local_user_index::bot_chat_events(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_chat_events::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            events: EventsSelectionCriteria::ByIndex(EventsByIndexArgs {
                events: vec![send_message_response.event_index],
            }),
        },
    );

    let local_user_index_canister::bot_chat_events::Response::Success(result) = &response else {
        panic!("'bot_chat_events' error: {response:?}");
    };

    assert_eq!(result.events.len(), 1);
    assert!(result.unauthorized.is_empty());
}

#[test]
fn send_direct_message() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let local_user_index = canister_ids.local_user_index(env, owner.user_id.canister_id());

    // Register a bot
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        "EchoBot".to_string(),
        "https://my.bot.xyz/".to_string(),
        BotDefinition {
            description: "Echo user input".to_string(),
            commands: vec![BotCommandDefinition {
                name: "echo".to_string(),
                description: Some("Echo user input".to_string()),
                placeholder: None,
                params: vec![BotCommandParam {
                    name: "message".to_string(),
                    description: None,
                    required: true,
                    param_type: BotCommandParamType::StringParam(StringParam {
                        min_length: 1,
                        max_length: 10000,
                        choices: vec![],
                        multi_line: true,
                    }),
                    placeholder: None,
                }],
                permissions: BotPermissions::text_only(),
                default_role: None,
                direct_messages: Some(true),
            }],
            autonomous_config: None,
            default_subscriptions: None,
            data_encoding: None,
            restricted_locations: None,
        },
    );

    // Install the bot as a direct chat
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::User(owner.user_id.into()),
        bot_id,
        BotPermissions::text_only(),
        None,
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Get an access token to call the "direct_message" command
    let message_id = random_from_u128();
    let user_message_id: MessageId = random_from_u128();
    let message_text = "Hello, world!".to_string();
    let access_token_args = access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
        bot_id,
        command: BotCommandInitial {
            name: "echo".to_string(),
            args: vec![BotCommandArg {
                name: "message".to_string(),
                value: BotCommandArgValue::String(message_text.clone()),
            }],
            meta: None,
        },
        scope: BotActionScope::Chat(BotActionChatDetails {
            chat: Chat::Direct(owner.user_id.into()),
            thread: None,
            message_id,
            user_message_id: Some(user_message_id),
        }),
    });
    let access_token =
        match client::local_user_index::access_token_v2(env, owner.principal, local_user_index, &access_token_args) {
            local_user_index_canister::access_token_v2::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };

    // Send message
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent {
                text: message_text.clone(),
            }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Call `events` and confirm the last but one event is a text message from the user
    // and the latest event is a message from the bot
    let response = client::user::happy_path::events(env, &owner, bot_id, 0.into(), true, 5, 10);

    assert_eq!(response.events.len(), 3);

    let user_event = &response.events[1];
    let ChatEvent::Message(message) = &user_event.event else {
        panic!("Expected user event to be a message: {user_event:?}");
    };
    let MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(&text_content.text, &message_text);
    assert!(message.bot_context().is_none());

    let bot_event = &response.events[2];
    let ChatEvent::Message(message) = &bot_event.event else {
        panic!("Expected bot event to be a message: {bot_event:?}");
    };
    let MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(&text_content.text, &message_text);
    assert!(message.bot_context().is_none());
}

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn send_multiple_updates_to_same_message(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let chat = match chat_type {
        ChatType::Group => Chat::Group(client::user::happy_path::create_group(
            env,
            &owner,
            &random_string(),
            true,
            true,
        )),
        ChatType::Direct => Chat::Direct(owner.user_id.into()),
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            Chat::Channel(community_id, channel_id)
        }
    };

    // A direct chat is held by the owner's canister, which holds other users too, so isn't named by
    // the chat's id
    let chat_canister_id = if matches!(chat, Chat::Direct(_)) { owner.canister() } else { chat.canister_id() };
    let local_user_index = canister_ids.local_user_index(env, chat_canister_id);

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Install the bot
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        chat.into(),
        bot_id,
        BotPermissions::text_only(),
        None,
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Get an access token to call the greet command
    let message_id = random_from_u128();
    let access_token_args = access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
        bot_id,
        command: BotCommandInitial {
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
    });
    let access_token =
        match client::local_user_index::access_token_v2(env, owner.principal, local_user_index, &access_token_args) {
            local_user_index_canister::access_token_v2::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };

    // Send message - unfinalised
    let username = owner.username();
    let text = format!("Hello 1 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Update message - unfinalised
    let text = format!("Hello 2 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Update message - finalised
    let text = format!("Hello 3 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Call `events` and confirm the latest event is a text message from the bot
    let response = match chat {
        Chat::Direct(_) => client::user::happy_path::events(env, &owner, bot_id, 0.into(), true, 5, 10),
        Chat::Group(chat_id) => client::group::happy_path::events(env, &owner, chat_id, 0.into(), true, 5, 10),
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::events(env, &owner, community_id, channel_id, 0.into(), true, 5, 10)
        }
    };

    let latest_event = response.events.last().expect("Expected some chat events");
    let ChatEvent::Message(message) = &latest_event.event else {
        panic!("Expected latest event to be a message: {latest_event:?}");
    };
    let MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(text_content.text, text);

    assert!(message.edited);
    assert!(message.bot_context().is_some());
    assert!(message.bot_context().as_ref().unwrap().finalised);

    // Try updating the same message again but expect it to fail
    let text = format!("Hello 4 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );

    assert!(!matches!(
        response,
        local_user_index_canister::bot_send_message::Response::Success(_)
    ));
}

#[test]
fn read_community_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);

    let local_user_index = canister_ids.local_user_index(env, community_id);

    // Register a bot
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    env.tick();

    let permissions = BotPermissions::default().with_community(&HashSet::from_iter([
        CommunityPermission::ReadMembership,
        CommunityPermission::ReadSummary,
    ]));

    // Add bot to community
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions.clone(),
        Some(permissions.clone()),
    );

    env.tick();

    // Generate some more community events
    client::community::happy_path::update_community(
        env,
        owner.principal,
        community_id,
        &community_canister::update_community::Args {
            name: Some(random_string()),
            description: Some(random_string()),
            rules: Some(UpdatedRules {
                text: random_string(),
                enabled: true,
                new_version: true,
            }),
            avatar: OptionUpdate::NoChange,
            banner: OptionUpdate::NoChange,
            permissions: None,
            gate_config: OptionUpdate::NoChange,
            public: Some(false),
            primary_language: Some("fr".to_string()),
        },
    );

    // TEST 1

    let response = client::local_user_index::bot_community_events(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_community_events::Args {
            community_id,
            events: CommunityEventsSelectionCriteria::Page(EventsPageArgs {
                start_index: EventIndex::from(7),
                ascending: false,
                max_events: 100,
            }),
        },
    );
    let local_user_index_canister::bot_community_events::Response::Success(result) = &response else {
        panic!("'bot_community_events' error: {response:?}");
    };
    let events: Vec<_> = result.events.iter().map(|e| e.event.event_type().unwrap()).collect();
    assert!(events.len() == 8);
    assert!(matches!(events[0], CommunityEventType::PrimaryLanguageChanged));
    assert!(matches!(events[7], CommunityEventType::Created));

    // TEST 2

    let response = client::local_user_index::bot_community_events(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_community_events::Args {
            community_id,
            events: CommunityEventsSelectionCriteria::ByIndex(CommunityEventsByIndexArgs {
                events: vec![EventIndex::from(4), EventIndex::from(2), EventIndex::from(7)],
            }),
        },
    );

    let local_user_index_canister::bot_community_events::Response::Success(result) = &response else {
        panic!("'bot_community_events' error: {response:?}");
    };
    let events: Vec<_> = result.events.iter().map(|e| e.event.event_type().unwrap()).collect();
    assert!(events.len() == 3);
    assert!(matches!(events[0], CommunityEventType::DescriptionChanged));
    assert!(matches!(events[1], CommunityEventType::BotAdded));
    assert!(matches!(events[2], CommunityEventType::PrimaryLanguageChanged));

    // TEST 3

    let response = client::local_user_index::bot_community_events(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_community_events::Args {
            community_id,
            events: CommunityEventsSelectionCriteria::Page(EventsPageArgs {
                start_index: EventIndex::from(3),
                ascending: true,
                max_events: 3,
            }),
        },
    );

    let local_user_index_canister::bot_community_events::Response::Success(result) = &response else {
        panic!("'bot_community_events' error: {response:?}");
    };
    let events: Vec<_> = result.events.iter().map(|e| e.event.event_type().unwrap()).collect();
    assert!(events.len() == 3);
    assert!(matches!(events[0], CommunityEventType::NameChanged));
    assert!(matches!(events[1], CommunityEventType::DescriptionChanged));
    assert!(matches!(events[2], CommunityEventType::RulesChanged));
}

#[test]
fn changing_channel_visibility_should_affect_subscriptions() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let chat = Chat::Channel(community_id, channel_id);
    let local_user_index = canister_ids.local_user_index(env, chat.canister_id());

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, _) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    // Install the bot
    let permissions = BotPermissions::default()
        .with_message(&HashSet::from_iter([MessagePermission::Text]))
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));

    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        chat.into(),
        bot_id,
        permissions.clone(),
        Some(permissions),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let latest_notification_index =
        |env: &PocketIc| client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index);
    let send_message = |env: &mut PocketIc| {
        let text = random_string();
        client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, &text, None);
        text
    };
    let set_public = |env: &mut PocketIc, public: bool| {
        client::community::happy_path::update_channel(
            env,
            owner.principal,
            community_id,
            &set_channel_public_args(channel_id, public),
        );
    };

    // Confirm the bot is notified of a message
    let from_index = latest_notification_index(env) + 1;
    let text = send_message(env);
    wait_for_bot_message_notification(env, *controller, local_user_index, from_index, bot_id, &text);

    // Setting an already public channel to public leaves the bot subscribed
    set_public(env, true);
    let from_index = latest_notification_index(env) + 1;
    let text = send_message(env);
    wait_for_bot_message_notification(env, *controller, local_user_index, from_index, bot_id, &text);

    // Make the channel private and send a message, then make it public again and send another. The
    // bot is only notified of the second, and notifications are queued in order, so a notification
    // of the first would have arrived by then.
    set_public(env, false);
    let from_index = latest_notification_index(env) + 1;
    let private_text = send_message(env);
    set_public(env, true);
    let public_text = send_message(env);
    let notified = wait_for_bot_message_notification(env, *controller, local_user_index, from_index, bot_id, &public_text);
    assert!(!notified.iter().any(|(_, text)| *text == private_text));
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn updating_autonomous_permissions_should_propogate_to_installations(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let chat = match chat_type {
        ChatType::Group => Chat::Group(client::user::happy_path::create_group(
            env,
            &owner,
            &random_string(),
            true,
            true,
        )),
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            Chat::Channel(community_id, channel_id)
        }
        ChatType::Direct => unreachable!(),
    };

    let local_user_index = canister_ids.local_user_index(env, chat.canister_id());

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, _) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Install the bot
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        chat.into(),
        bot_id,
        BotPermissions::text_only(),
        Some(
            BotPermissions::default()
                .with_message(&HashSet::from_iter([MessagePermission::Text]))
                .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages])),
        ),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Update the bot's autonomous permissions to remove ReadMessages
    client::user_index::happy_path::update_bot(
        env,
        canister_ids.user_index,
        owner.principal,
        bot_id,
        None,
        None,
        None,
        Some(BotDefinition {
            description: "Updated description".to_string(),
            commands: vec![],
            autonomous_config: Some(AutonomousConfig {
                permissions: BotPermissions::default(), // No permissions
            }),
            default_subscriptions: Some(BotSubscriptions {
                community: HashSet::new(),
                chat: HashSet::from_iter([ChatEventType::Message]),
            }),
            data_encoding: None,
            restricted_locations: None,
        }),
    );

    env.advance_time(Duration::from_millis(1000));
    tick_many(env, 3);

    // Lookup up the latest notification index
    let latest_notification_index_at_start =
        client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index);

    // Send a text message
    let text = "Hello World";
    let message_id = random_from_u128();
    match chat {
        Chat::Group(group_id) => {
            client::group::happy_path::send_text_message(env, &owner, group_id, None, text, Some(message_id));
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_text_message(
                env,
                &owner,
                community_id,
                channel_id,
                None,
                text,
                Some(message_id),
            );
        }
        Chat::Direct(_) => unreachable!(),
    };

    // Confirm no notification was sent to the bot
    tick_many(env, 5);

    let notifications = client::local_user_index::happy_path::notifications(
        env,
        *controller,
        local_user_index,
        latest_notification_index_at_start + 1,
    );

    assert!(notifications.notifications.is_empty());
}

#[test_case(false; "owner_updates_permissions")]
#[test_case(true; "bot_definition_updated")]
fn updating_bot_should_not_subscribe_it_to_private_channels(update_definition: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let public_channel_id =
        client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let private_channel_id =
        client::community::happy_path::create_channel(env, owner.principal, community_id, false, random_string());
    let local_user_index = canister_ids.local_user_index(env, community_id);

    // Register a bot
    let (bot_id, _) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    // Install the bot
    let permissions = BotPermissions::default()
        .with_message(&HashSet::from_iter([MessagePermission::Text]))
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));

    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions.clone(),
        Some(permissions.clone()),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    if update_definition {
        // Removing the bot's commands changes its command permissions, which updates its installations
        let mut definition = default_bot_definition(random_string());
        definition.commands.clear();
        client::user_index::happy_path::update_bot(
            env,
            canister_ids.user_index,
            owner.principal,
            bot_id,
            None,
            None,
            None,
            Some(definition),
        );
    } else {
        let response = client::community::update_bot(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::update_bot::Args {
                bot_id,
                granted_permissions: BotPermissions::text_only(),
                granted_autonomous_permissions: Some(permissions),
            },
        );
        assert!(matches!(response, community_canister::update_bot::Response::Success));
    }

    env.advance_time(Duration::from_millis(1000));
    tick_many(env, 5);

    // Send a message in the private channel, then one in the public channel. The bot is only notified
    // of the second, and notifications are queued in order, so a notification of the first would have
    // arrived by then.
    let from_index = client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index) + 1;
    let private_text = random_string();
    client::community::happy_path::send_text_message(env, &owner, community_id, private_channel_id, None, &private_text, None);
    let public_text = random_string();
    client::community::happy_path::send_text_message(env, &owner, community_id, public_channel_id, None, &public_text, None);

    let notified = wait_for_bot_message_notification(env, *controller, local_user_index, from_index, bot_id, &public_text);
    assert!(!notified.iter().any(|(_, text)| *text == private_text));
}

#[test]
fn importing_group_subscribes_communitys_bots_rather_than_groups() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);

    let permissions = BotPermissions::default()
        .with_message(&HashSet::from_iter([MessagePermission::Text]))
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));

    // Install one bot in the group and another in the community
    let (group_bot_id, _) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, group_id),
        BotInstallationLocation::Group(group_id),
        group_bot_id,
        permissions.clone(),
        Some(permissions.clone()),
    );

    let (community_bot_id, _) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, community_id),
        BotInstallationLocation::Community(community_id),
        community_bot_id,
        permissions.clone(),
        Some(permissions),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Import the (public) group into the community
    let channel_id = client::community::happy_path::import_group(env, owner.principal, community_id, group_id).channel_id;
    tick_many(env, 20);

    // The community's bot is notified of messages in the channel, but the group's bot, which isn't
    // installed in the community, isn't. Notifications are queued in order, so a notification for the
    // group's bot would have arrived with the community bot's.
    let local_user_index = canister_ids.local_user_index(env, community_id);
    let from_index = client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index) + 1;
    let text = random_string();
    client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, &text, None);

    wait_for_bot_message_notification(env, *controller, local_user_index, from_index, community_bot_id, &text);
    assert!(bot_message_notifications(env, *controller, local_user_index, from_index, group_bot_id).is_empty());
}

#[test]
fn new_local_user_index_learns_of_existing_bots() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let (bot_id, old_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    client::user_index::happy_path::publish_bot(env, *controller, canister_ids.user_index, bot_id);

    // It's the Discord bridge bot too, which a LocalUserIndex must know of to relay its messages
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);
    tick_many(env, 3);
    let response = client::user_index::set_bridge_bot(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::set_bridge_bot::Args {
            platform: BridgePlatform::Discord,
            bot_id: Some(bot_id),
        },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");

    // Expand onto a subnet the Registry hasn't expanded onto yet. In test mode the Registry takes
    // a LocalUserIndex created up front, then installs it and tells the other canisters of it
    let subnet_id = env.topology().get_sns().unwrap();
    let local_user_index = env.create_canister_on_subnet(Some(canister_ids.registry), None, subnet_id);
    env.add_cycles(local_user_index, INIT_CYCLES_BALANCE);
    client::registry::happy_path::expand_onto_subnet(
        env,
        *controller,
        canister_ids.registry,
        subnet_id,
        Some(local_user_index),
    );

    let knows_bot = |env: &PocketIc| {
        metrics(env, local_user_index)["bots"]
            .as_array()
            .unwrap()
            .iter()
            .any(|b| b["user_id"] == bot_id.to_string())
    };

    for _ in 0..30 {
        if knows_bot(env) {
            break;
        }
        env.tick();
    }
    assert!(knows_bot(env));

    let bridge_bot = |env: &PocketIc| {
        metrics(env, local_user_index)["bridge_bots"]["Discord"]
            .as_str()
            .map(|b| b.to_string())
    };
    for _ in 0..30 {
        if bridge_bot(env).is_some() {
            break;
        }
        env.tick();
    }
    assert_eq!(bridge_bot(env), Some(bot_id.to_string()));

    // The bot was told of its registration when it registered, so the new LocalUserIndex doesn't tell it again
    assert!(bot_notification_encodings(env, *controller, local_user_index, 0, bot_id).is_empty());

    // The new LocalUserIndex also has the bot among its users, by its principal
    let lookup_user = |env: &PocketIc, principal: Principal| match client::local_user_index::c2c_lookup_user(
        env,
        Principal::anonymous(),
        local_user_index,
        &local_user_index_canister::c2c_lookup_user::Args {
            user_id_or_principal: principal,
        },
    ) {
        local_user_index_canister::c2c_lookup_user::Response::Success(user) => Some(user.user_id),
        local_user_index_canister::c2c_lookup_user::Response::UserNotFound => None,
    };
    assert_eq!(lookup_user(env, old_principal), Some(bot_id));

    // Rotate the bot's principal, which updates the new LocalUserIndex's users too
    let new_principal = random_principal();
    client::user_index::happy_path::update_bot(
        env,
        canister_ids.user_index,
        owner.principal,
        bot_id,
        Some(new_principal),
        None,
        None,
        None,
    );

    for _ in 0..30 {
        if lookup_user(env, new_principal).is_some() {
            break;
        }
        env.tick();
    }
    assert_eq!(lookup_user(env, new_principal), Some(bot_id));
    assert_eq!(lookup_user(env, old_principal), None);

    // The env now has a LocalUserIndex on a subnet its `canister_ids` don't know of
    wrapper.discard();
}

#[test]
fn updating_bot_principal_and_data_encoding_reaches_local_user_indexes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let chat = Chat::Channel(community_id, channel_id);
    let local_user_index = canister_ids.local_user_index(env, community_id);

    // Register and install a bot
    let (bot_id, old_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    let permissions = BotPermissions::default()
        .with_message(&HashSet::from_iter([MessagePermission::Text]))
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));

    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions.clone(),
        Some(permissions),
    );

    // Rotate the bot's principal
    let new_principal = random_principal();
    client::user_index::happy_path::update_bot(
        env,
        canister_ids.user_index,
        owner.principal,
        bot_id,
        Some(new_principal),
        None,
        None,
        None,
    );

    env.advance_time(Duration::from_millis(1000));
    tick_many(env, 5);

    let send_message = |env: &mut PocketIc, principal: Principal| {
        client::local_user_index::bot_send_message(
            env,
            principal,
            local_user_index,
            &local_user_index_canister::bot_send_message::Args {
                chat_context: BotChatContext::Autonomous(chat),
                thread: None,
                message_id: None,
                replies_to: None,
                content: BotMessageContent::Text(TextContent { text: random_string() }),
                block_level_markdown: false,
                finalised: true,
                og_previews: None,
                bridged_from: None,
            },
        )
    };

    // The bot is authenticated by its new principal but no longer by its old one
    let response = send_message(env, new_principal);
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)),
        "'bot_send_message' error: {response:?}"
    );

    let response = send_message(env, old_principal);
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::BotNotAuthenticated)),
        "'bot_send_message' expected BotNotAuthenticated: {response:?}"
    );

    // The bot can upload files as its new principal
    let allocated_bucket = |env: &PocketIc| {
        client::storage_index::allocated_bucket_v2(
            env,
            new_principal,
            canister_ids.storage_index,
            &storage_index_canister::allocated_bucket_v2::Args {
                file_hash: [1; 32],
                file_size: 1000,
                file_id_seed: None,
            },
        )
    };
    for _ in 0..20 {
        if matches!(
            allocated_bucket(env),
            storage_index_canister::allocated_bucket_v2::Response::Success(_)
        ) {
            break;
        }
        env.tick();
    }
    let response = allocated_bucket(env);
    assert!(
        matches!(response, storage_index_canister::allocated_bucket_v2::Response::Success(_)),
        "'allocated_bucket_v2' error: {response:?}"
    );

    // Switch the bot's data encoding to Candid
    let mut definition = default_bot_definition(random_string());
    definition.data_encoding = Some(BotDataEncoding::Candid);
    client::user_index::happy_path::update_bot(
        env,
        canister_ids.user_index,
        owner.principal,
        bot_id,
        None,
        None,
        None,
        Some(definition),
    );

    env.advance_time(Duration::from_millis(1000));
    tick_many(env, 5);

    let from_index = client::local_user_index::happy_path::latest_notification_index(env, *controller, local_user_index) + 1;
    let text = random_string();
    client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, &text, None);

    assert_eq!(
        wait_for_bot_message_notification(env, *controller, local_user_index, from_index, bot_id, &text),
        vec![(BotDataEncoding::Candid, text)]
    );
}

#[test]
fn bots_data_encoding_shown_by_user_index_and_local_user_index() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let (default_bot_id, _) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    let mut definition = default_bot_definition(random_string());
    definition.data_encoding = Some(BotDataEncoding::Candid);
    let (candid_bot_id, _) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        definition,
    );

    let response = client::http_request(
        env,
        Principal::anonymous(),
        canister_ids.user_index,
        &HttpRequest {
            method: "GET".to_string(),
            url: "/bots".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    assert_eq!(response.status_code, 200);

    let bots: Vec<serde_json::Value> = serde_json::from_slice(&response.body).unwrap();
    let encoding = |bot_id: UserId| {
        bots.iter()
            .find(|bot| bot["user_id"] == bot_id.to_string())
            .map(|bot| bot["data_encoding"].clone())
    };
    // A bot which doesn't set one gets MsgPack
    assert_eq!(encoding(default_bot_id), Some("MsgPack".into()));
    assert_eq!(encoding(candid_bot_id), Some("Candid".into()));

    // The LocalUserIndexes keep their own copy, which notifications are encoded with
    let local_user_index = canister_ids.local_user_index(env, owner.user_id.canister_id());
    let local_encoding = |env: &PocketIc, bot_id: UserId| {
        metrics(env, local_user_index)["bots"]
            .as_array()
            .unwrap()
            .iter()
            .find(|bot| bot["user_id"] == bot_id.to_string())
            .map(|bot| bot["data_encoding"].clone())
    };
    for _ in 0..30 {
        if local_encoding(env, candid_bot_id).is_some() {
            break;
        }
        env.tick();
    }
    assert_eq!(local_encoding(env, default_bot_id), Some("MsgPack".into()));
    assert_eq!(local_encoding(env, candid_bot_id), Some("Candid".into()));
}

#[test]
fn json_data_encoding_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let mut definition = default_bot_definition(random_string());
    definition.data_encoding = Some(BotDataEncoding::Json);

    let response = client::user_index::register_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        &user_index_canister::register_bot::Args {
            principal: random_principal(),
            name: random_string(),
            avatar: None,
            endpoint: "https://my.bot.xyz/".to_string(),
            definition: definition.clone(),
            permitted_install_location: None,
        },
    );
    assert!(
        matches!(response, user_index_canister::register_bot::Response::InvalidRequest(_)),
        "'register_bot' expected InvalidRequest: {response:?}"
    );

    let (bot_id, _) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    let response = client::user_index::update_bot(
        env,
        owner.principal,
        canister_ids.user_index,
        &user_index_canister::update_bot::Args {
            bot_id,
            owner: None,
            principal: None,
            avatar: OptionUpdate::NoChange,
            endpoint: None,
            definition: Some(definition),
        },
    );
    assert!(
        matches!(&response, user_index_canister::update_bot::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "'update_bot' expected InvalidRequest: {response:?}"
    );
}

fn set_channel_public_args(channel_id: ChannelId, public: bool) -> community_canister::update_channel::Args {
    community_canister::update_channel::Args {
        channel_id,
        public: Some(public),
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        messages_visible_to_non_members: None,
        permissions_v2: None,
        events_ttl: OptionUpdate::NoChange,
        gate_config: OptionUpdate::NoChange,
        external_url: OptionUpdate::NoChange,
    }
}

// The data encoding of each notification for the bot from `from_index` onwards
fn bot_notification_encodings(
    env: &PocketIc,
    controller: Principal,
    local_user_index: CanisterId,
    from_index: u64,
    bot_id: UserId,
) -> Vec<BotDataEncoding> {
    client::local_user_index::happy_path::notifications(env, controller, local_user_index, from_index)
        .notifications
        .into_iter()
        .filter_map(|n| match n.value {
            NotificationEnvelope::Bot(n) => n.recipients.get(&bot_id).copied(),
            NotificationEnvelope::User(_) => None,
        })
        .collect()
}

// Ticks until the bot has been notified of the text message given, then returns the data encoding and
// text of every text message the bot has been notified of from `from_index` onwards
fn wait_for_bot_message_notification(
    env: &mut PocketIc,
    controller: Principal,
    local_user_index: CanisterId,
    from_index: u64,
    bot_id: UserId,
    text: &str,
) -> Vec<(BotDataEncoding, String)> {
    for _ in 0..20 {
        let notified = bot_message_notifications(env, controller, local_user_index, from_index, bot_id);
        if notified.iter().any(|(_, t)| t == text) {
            return notified;
        }
        env.tick();
    }
    panic!("The bot wasn't notified of the message '{text}'");
}

fn bot_message_notifications(
    env: &PocketIc,
    controller: Principal,
    local_user_index: CanisterId,
    from_index: u64,
    bot_id: UserId,
) -> Vec<(BotDataEncoding, String)> {
    client::local_user_index::happy_path::notifications(env, controller, local_user_index, from_index)
        .notifications
        .into_iter()
        .filter_map(|n| {
            let NotificationEnvelope::Bot(n) = n.value else {
                return None;
            };
            let encoding = *n.recipients.get(&bot_id)?;
            let payload = &n.event_map.get(&encoding)?.data;
            let wrapper: BotEventWrapper = match encoding {
                BotDataEncoding::Candid => candid::decode_one(payload).unwrap(),
                _ => msgpack::deserialize_then_unwrap(payload),
            };
            let BotEvent::Chat(BotChatEvent {
                event: ChatEvent::Message(message),
                ..
            }) = wrapper.event
            else {
                return None;
            };
            let MessageContent::Text(content) = message.content else {
                return None;
            };
            Some((encoding, content.text))
        })
        .collect()
}

pub(crate) fn register_bot(
    env: &mut PocketIc,
    owner: &User,
    user_index_canister_id: CanisterId,
    bot_name: String,
    command_name: String,
) -> (UserId, Principal) {
    client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        user_index_canister_id,
        bot_name,
        "https://my.bot.xyz/".to_string(),
        default_bot_definition(command_name),
    )
}

pub(crate) fn default_bot_definition(command_name: String) -> BotDefinition {
    let commands = vec![BotCommandDefinition {
        name: command_name,
        description: Some("Hello {user}".to_string()),
        placeholder: None,
        params: vec![],
        permissions: BotPermissions::text_only(),
        default_role: None,
        direct_messages: None,
    }];

    BotDefinition {
        description: "greet".to_string(),
        commands,
        autonomous_config: Some(AutonomousConfig {
            permissions: BotPermissions::default()
                .with_message(&HashSet::from_iter([MessagePermission::Text]))
                .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages])),
        }),
        default_subscriptions: Some(BotSubscriptions {
            community: HashSet::new(),
            chat: HashSet::from_iter([ChatEventType::Message]),
        }),
        data_encoding: None,
        restricted_locations: None,
    }
}
