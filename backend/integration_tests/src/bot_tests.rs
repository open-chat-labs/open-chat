use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::bot_actions::MessageContent;
use types::{
    AccessTokenType, BotAction, BotCommandArgs, Chat, ChatEvent, ChatId, MessagePermission, SlashCommandPermissions,
    SlashCommandSchema, TextContent,
};

#[test]
fn bot_smoke_test() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Create a user account and a group
    let TestData { user, group_id } = init_test_data(env, canister_ids, *controller);

    // Register a bot
    let bot_name = random_string();
    let command_name = "greet".to_string();
    let bot_principal = client::register_bot(
        env,
        canister_ids,
        &user,
        bot_name.clone(),
        "greet".to_string(),
        "https://my.bot.xyz/".to_string(),
        vec![SlashCommandSchema {
            name: command_name.clone(),
            description: Some("Hello {user}".to_string()),
            params: vec![],
            permissions: SlashCommandPermissions {
                community: HashSet::new(),
                chat: HashSet::new(),
                message: HashSet::from_iter([MessagePermission::Text]),
                thread: HashSet::new(),
            },
        }],
    );

    let initial_time = now_millis(env);
    println!("initial_time: {initial_time}");

    // Confirm bot returned in `bot_updates`
    let response = client::user_index::happy_path::bot_updates(env, user.principal, canister_ids.user_index, 0);
    assert_eq!(response.added_or_updated.len(), 1);

    let bot = &response.added_or_updated[0];
    assert_eq!(bot.name, bot_name);

    // Explore bots and pick first one
    let response = client::user_index::happy_path::explore_bots(env, user.principal, canister_ids.user_index, None);
    assert_eq!(response.matches.len(), 1);
    assert_eq!(response.matches[0].id, bot.id);

    // Add bot to group with inadequate permissions
    let mut granted_permissions = SlashCommandPermissions::default();
    client::group::happy_path::add_bot(env, user.principal, group_id, bot.id, granted_permissions.clone());

    let bot_added_timestamp = now_millis(env);
    env.advance_time(Duration::from_millis(1000));
    env.tick();

    // Confirm bot returned in `selected_initial`
    let response = client::group::happy_path::selected_initial(env, &user, group_id);
    assert_eq!(response.bots.len(), 1);
    assert_eq!(response.bots[0].user_id, bot.id);

    // Get an access token to call the greet command
    let chat = Chat::Group(group_id);
    let message_id = random_from_u128();
    let access_token_args = local_user_index_canister::access_token::Args {
        token_type: AccessTokenType::BotCommand(BotCommandArgs {
            user_id: user.user_id,
            bot: bot.id,
            chat,
            thread_root_message_index: None,
            message_id,
            command_name: command_name.clone(),
            parameters: "".to_string(),
            version: 1, // TODO: Remove this
            command_text: command_name.clone(),
        }),
        chat,
    };
    let response =
        client::local_user_index::access_token(env, user.principal, canister_ids.local_user_index, &access_token_args);

    // Confirm bot is unauthorised
    assert!(matches!(
        response,
        local_user_index_canister::access_token::Response::NotAuthorized
    ));

    // Update the group bot permissions
    granted_permissions.message.insert(MessagePermission::Text);
    client::group::happy_path::update_bot(env, user.principal, group_id, bot.id, granted_permissions.clone());

    // Confirm bot returned in `selected_update`
    let response = client::group::happy_path::selected_updates(env, user.principal, group_id, bot_added_timestamp)
        .expect("Expected `selected_updates`");
    assert_eq!(response.bots_added_or_updated.len(), 1);
    assert_eq!(response.bots_added_or_updated[0].user_id, bot.id);

    // Try again to get an access token to call the greet command
    let access_token =
        match client::local_user_index::access_token(env, user.principal, canister_ids.local_user_index, &access_token_args) {
            local_user_index_canister::access_token::Response::Success(access_token) => access_token,
            response => panic!("'access_token' error: {response:?}"),
        };

    println!("ACCESS TOKEN: {access_token}");

    // Call execute_bot_command as bot
    let username = user.username();
    let text = format!("Hello {username}");
    let response = client::local_user_index::execute_bot_command(
        env,
        bot_principal,
        canister_ids.local_user_index,
        &local_user_index_canister::execute_bot_command::Args {
            action: BotAction::SendMessage(MessageContent::Text(TextContent { text: text.clone() })),
            jwt: access_token,
        },
    );

    if response.is_err() {
        panic!("'execute_bot_command' error: {response:?}");
    }

    // Call `events` and confirm the latest event is a text message from the bot
    let response = client::group::happy_path::events(env, &user, group_id, 0.into(), true, 5, 10);

    let latest_event = response.events.last().expect("Expected some channel events");
    let ChatEvent::Message(message) = &latest_event.event else {
        panic!("Expected latest event to be a message: {latest_event:?}");
    };
    let types::MessageContent::Text(text_content) = &message.content else {
        panic!("Expected message to be text");
    };
    assert_eq!(text_content.text, text);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);

    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);

    TestData { user, group_id }
}

struct TestData {
    user: User,
    group_id: ChatId,
}
