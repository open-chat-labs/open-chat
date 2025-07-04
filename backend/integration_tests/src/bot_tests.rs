use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use community_canister::c2c_bot_community_events::{
    EventsByIndexArgs as CommunityEventsByIndexArgs, EventsSelectionCriteria as CommunityEventsSelectionCriteria,
};
use community_canister::community_events::EventsPageArgs;
use local_user_index_canister::access_token_v2::{self, BotActionByCommandArgs, BotCommandInitial};
use local_user_index_canister::chat_events::{EventsByIndexArgs, EventsSelectionCriteria};
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    AutonomousBotScope, AutonomousConfig, BotActionChatDetails, BotActionScope, BotChatContext, BotCommandArg,
    BotCommandArgValue, BotCommandDefinition, BotCommandParam, BotCommandParamType, BotDefinition, BotInstallationLocation,
    BotMessageContent, BotPermissions, CanisterId, Chat, ChatEvent, ChatEventType, ChatPermission, ChatType,
    CommunityEventType, CommunityPermission, EventIndex, MessageContent, MessageId, MessagePermission, NotificationEnvelope,
    OptionUpdate, Rules, StringParam, TextContent, UpdatedRules, UserId,
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
        canister_ids.local_user_index(env, group_id),
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

    let response = client::local_user_index::access_token_v2(
        env,
        owner.principal,
        canister_ids.local_user_index(env, group_id),
        &access_token_args,
    );

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
    let access_token = match client::local_user_index::access_token_v2(
        env,
        owner.principal,
        canister_ids.local_user_index(env, group_id),
        &access_token_args,
    ) {
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Command(access_token.clone()),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
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

    let subscribe_response = client::local_user_index::bot_subscribe_to_events(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::bot_subscribe_to_events::Args {
            scope: AutonomousBotScope::Chat(chat),
            chat_events: HashSet::from_iter([ChatEventType::Message]),
            community_events: HashSet::new(),
        },
    );

    assert!(
        matches!(
            subscribe_response,
            local_user_index_canister::bot_subscribe_to_events::Response::Success
        ),
        "'bot_subscribe_to_events' error: {subscribe_response:?}"
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
    assert!(
        notifications
            .notifications
            .iter()
            .any(|n| matches!(&n.value, NotificationEnvelope::Bot(n) if n.recipients.contains_key(&bot_id)))
    );
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

    // Register a bot
    let bot_name = random_string();
    let command_name = random_string();
    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, bot_name.clone(), command_name.clone());

    // Add bot to community
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, community_id),
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
        canister_ids.local_user_index(env, community_id),
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
        canister_ids.local_user_index(env, community_id),
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
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }

    // Bot removes the channel
    let response = client::local_user_index::bot_delete_channel(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
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

    let local_user_index = canister_ids.local_user_index(env, owner.user_id);

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

    let local_user_index = canister_ids.local_user_index(env, chat.canister_id());

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

fn register_bot(
    env: &mut PocketIc,
    owner: &User,
    user_index_canister_id: CanisterId,
    bot_name: String,
    command_name: String,
) -> (UserId, Principal) {
    // Register a bot
    let endpoint = "https://my.bot.xyz/".to_string();
    let description = "greet".to_string();

    let commands = vec![BotCommandDefinition {
        name: command_name,
        description: Some("Hello {user}".to_string()),
        placeholder: None,
        params: vec![],
        permissions: BotPermissions::text_only(),
        default_role: None,
        direct_messages: None,
    }];

    client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        user_index_canister_id,
        bot_name.clone(),
        endpoint.clone(),
        BotDefinition {
            description: description.clone(),
            commands: commands.clone(),
            autonomous_config: Some(AutonomousConfig {
                permissions: BotPermissions::text_only(),
            }),
            default_subscriptions: None,
            data_encoding: None,
        },
    )
}
