use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv, User};
use candid::Principal;
use community_canister::generate_bot_api_key;
use local_user_index_canister::access_token_v2::{self, BotActionByCommandArgs};
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    AccessTokenScope, AuthToken, AutonomousConfig, BotActionChatDetails, BotActionScope, BotApiKeyToken, BotCommand,
    BotDefinition, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId, Chat, ChatEvent,
    CommunityPermission, MessageContent, MessagePermission, Rules, SlashCommandSchema, TextContent, UserId,
};
use utils::base64;

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

    // Explore bots and check new bot is returned
    let response = client::user_index::happy_path::explore_bots(env, owner.principal, canister_ids.user_index, None);
    assert!(response.matches.iter().any(|b| b.id == bot_id));

    // Add bot to group with inadequate permissions
    let mut granted_permissions = BotPermissions::default();
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        canister_ids.local_user_index(env, group_id),
        BotInstallationLocation::Group(group_id),
        bot.id,
        granted_permissions.clone(),
    );

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
        command: BotCommand {
            name: command_name.clone(),
            args: Vec::new(),
            initiator: owner.user_id,
        },
        scope: BotActionScope::Chat(BotActionChatDetails {
            chat,
            thread: None,
            message_id,
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
    granted_permissions.message.insert(MessagePermission::Text);
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
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            auth_token: AuthToken::Jwt(access_token.clone()),
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
    assert!(message.bot_context.is_some());
    assert!(!message.bot_context.as_ref().unwrap().finalised);

    // Call execute_bot_action as bot - finalised message
    let text = "Hello world".to_string();

    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            auth_token: AuthToken::Jwt(access_token.clone()),
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
    assert!(message.bot_context.is_some());
    assert!(message.bot_context.as_ref().unwrap().finalised);

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
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Generate an API key for the bot in the channel
    let api_key = match client::community::generate_bot_api_key(
        env,
        owner.principal,
        community_id.into(),
        &generate_bot_api_key::Args {
            bot_id,
            requested_permissions: BotPermissions::text_only(),
            channel_id: Some(channel_id),
        },
    ) {
        generate_bot_api_key::Response::Success(result) => result.api_key,
        response => panic!("'generate_bot_api_key' error: {response:?}"),
    };

    // Decode the API key and assert expected claims
    let api_key_token = base64::to_value::<BotApiKeyToken>(&api_key).expect("Expected valid API key");
    assert_eq!(api_key_token.bot_id, bot_id);
    assert_eq!(api_key_token.gateway, canister_ids.local_user_index(env, community_id));
    let AccessTokenScope::Chat(Chat::Channel(token_community_id, token_channel_id)) = api_key_token.scope else {
        panic!("Expected API key scope to be channel");
    };
    assert_eq!(token_community_id, community_id);
    assert_eq!(token_channel_id, channel_id);

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Call execute_bot_action
    let text = "Hello world".to_string();
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            auth_token: AuthToken::ApiKey(api_key),
        },
    );

    if !matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)) {
        panic!("'bot_send_message' error: {response:?}");
    }
}

#[test]
fn create_channel_by_api_key() {
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
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Generate an API key for the bot in the community.
    // It doesn't need send message permissions (which applies to all channels) because it
    // will be the owner of the channel it creates.
    let api_key = match client::community::generate_bot_api_key(
        env,
        owner.principal,
        community_id.into(),
        &generate_bot_api_key::Args {
            bot_id,
            requested_permissions: BotPermissions {
                community: HashSet::from_iter(vec![CommunityPermission::CreatePublicChannel]),
                chat: HashSet::new(),
                message: HashSet::new(),
            },
            channel_id: None,
        },
    ) {
        generate_bot_api_key::Response::Success(result) => result.api_key,
        response => panic!("'generate_bot_api_key' error: {response:?}"),
    };

    // The bot creates a channel
    let response = client::local_user_index::bot_create_channel(
        env,
        bot_principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::bot_create_channel::Args {
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
            auth_token: AuthToken::ApiKey(api_key.clone()),
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
            channel_id: Some(result.channel_id),
            message_id: None,
            content: BotMessageContent::Text(TextContent {
                text: "I'm sorry, Dave. I'm afraid I can't do that.".to_string(),
            }),
            block_level_markdown: false,
            finalised: true,
            auth_token: AuthToken::ApiKey(api_key.clone()),
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
            channel_id: result.channel_id,
            auth_token: AuthToken::ApiKey(api_key),
        },
    );

    if !matches!(response, local_user_index_canister::bot_delete_channel::Response::Success) {
        panic!("'bot_delete_channel' error: {response:?}");
    }
}

#[test]
fn send_multiple_updates_to_same_message() {
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
        canister_ids.local_user_index(env, group_id),
        BotInstallationLocation::Group(group_id),
        bot_id,
        BotPermissions::text_only(),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Get an access token to call the greet command
    let chat = Chat::Group(group_id);
    let message_id = random_from_u128();
    let access_token_args = access_token_v2::Args::BotActionByCommand(BotActionByCommandArgs {
        bot_id,
        command: BotCommand {
            name: command_name.clone(),
            args: Vec::new(),
            initiator: owner.user_id,
        },
        scope: BotActionScope::Chat(BotActionChatDetails {
            chat,
            thread: None,
            message_id,
        }),
    });
    let access_token = match client::local_user_index::access_token_v2(
        env,
        owner.principal,
        canister_ids.local_user_index(env, group_id),
        &access_token_args,
    ) {
        local_user_index_canister::access_token_v2::Response::Success(access_token) => access_token,
        response => panic!("'access_token' error: {response:?}"),
    };

    // Send message - unfinalised
    let username = owner.username();
    let text = format!("Hello 1 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            auth_token: AuthToken::Jwt(access_token.clone()),
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: false,
            auth_token: AuthToken::Jwt(access_token.clone()),
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
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            auth_token: AuthToken::Jwt(access_token.clone()),
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
    assert!(message.bot_context.is_some());
    assert!(message.bot_context.as_ref().unwrap().finalised);

    // Try updating the same message again but expect it to fail
    let text = format!("Hello 4 {username}");
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        canister_ids.local_user_index(env, group_id),
        &local_user_index_canister::bot_send_message::Args {
            channel_id: None,
            message_id: None,
            content: BotMessageContent::Text(TextContent { text: text.clone() }),
            block_level_markdown: false,
            finalised: true,
            auth_token: AuthToken::Jwt(access_token.clone()),
        },
    );

    assert!(!matches!(
        response,
        local_user_index_canister::bot_send_message::Response::Success(_)
    ));
}

fn register_bot(
    env: &mut PocketIc,
    user: &User,
    user_index_canister_id: CanisterId,
    bot_name: String,
    command_name: String,
) -> (UserId, Principal) {
    // Register a bot
    let endpoint = "https://my.bot.xyz/".to_string();
    let description = "greet".to_string();

    let commands = vec![SlashCommandSchema {
        name: command_name,
        description: Some("Hello {user}".to_string()),
        placeholder: None,
        params: vec![],
        permissions: BotPermissions::text_only(),
    }];

    let bot_principal = client::user_index::happy_path::register_bot(
        env,
        user,
        user_index_canister_id,
        bot_name.clone(),
        endpoint.clone(),
        BotDefinition {
            description: description.clone(),
            commands: commands.clone(),
            autonomous_config: Some(AutonomousConfig {
                permissions: BotPermissions::text_only(),
            }),
        },
    );

    let response = client::user_index::happy_path::explore_bots(env, user.principal, user_index_canister_id, None);
    let bot_id = response.matches.iter().find(|b| b.name == bot_name).unwrap().id;

    (bot_id, bot_principal)
}
