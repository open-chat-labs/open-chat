use crate::bot_tests::default_bot_definition;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    AutonomousConfig, BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId, ChannelId, Chat,
    ChatEvent, CommunityId, EventIndex, MessageButton, MessageButtonStyle, MessageContent, MessageContentInitial, MessageId,
    MessagePermission, MiniAppContent, UnitResult, UserId,
};

#[test]
fn a_bot_posts_a_mini_app_and_changes_its_buttons() {
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

    let response = send(
        env,
        bot_principal,
        local_user_index,
        chat,
        message_id,
        lobby(owner.user_id, false),
    );
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    tick_many(env, 3);

    // Only the owner, who started the game, is shown its Start button
    let read = |env: &PocketIc, user: &User| buttons(env, user, community_id, channel_id, result.event_index);
    assert_eq!(read(env, &owner), vec![vec!["join", "leave"], vec!["start"]]);
    assert_eq!(read(env, &member), vec![vec!["join", "leave"]]);

    // An edit which only changes the buttons is saved
    let response = client::local_user_index::bot_edit_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_edit_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id,
            content: BotMessageContent::MiniApp(lobby(owner.user_id, true)),
            block_level_markdown: false,
            og_previews: None,
        },
    );
    assert!(
        matches!(response, UnitResult::Success),
        "'bot_edit_message' error: {response:?}"
    );
    tick_many(env, 3);

    assert_eq!(read(env, &member), vec![vec!["leave"]]);
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
        lobby(owner.user_id, false),
    );
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Error(_)),
        "Expected an error: {response:?}"
    );
}

#[test]
fn a_member_cant_post_or_forward_a_mini_app() {
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

    for forwarding in [false, true] {
        let response = client::community::send_message(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::send_message::Args {
                channel_id,
                thread_root_message_index: None,
                message_id: random_from_u128(),
                content: MessageContentInitial::MiniApp(lobby(owner.user_id, false)),
                sender_name: owner.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding,
                block_level_markdown: false,
                community_rules_accepted: None,
                channel_rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        );
        assert!(
            matches!(response, community_canister::send_message::Response::Error(_)),
            "Expected an error: {response:?}"
        );
    }
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
            .with_message(&HashSet::from_iter([MessagePermission::Text, MessagePermission::MiniApp])),
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
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Community(community_id),
        bot_id,
        permissions.clone(),
        Some(permissions),
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

// A game's lobby, whose Start button only its host is shown. Once joined, a player is offered Leave.
fn lobby(host: UserId, joined: bool) -> MiniAppContent {
    let button = |id: &str, visible_to: Option<Vec<UserId>>| MessageButton {
        id: id.to_string(),
        label: id.to_string(),
        style: MessageButtonStyle::Primary,
        visible_to,
    };
    let first_row = if joined { vec![button("leave", None)] } else { vec![button("join", None), button("leave", None)] };
    MiniAppContent {
        text: "**Uno** · waiting for players".to_string(),
        button_rows: vec![first_row, vec![button("start", Some(vec![host]))]],
    }
}

fn buttons(
    env: &PocketIc,
    user: &User,
    community_id: CommunityId,
    channel_id: ChannelId,
    event_index: EventIndex,
) -> Vec<Vec<String>> {
    let events = client::community::happy_path::events_by_index(env, user, community_id, channel_id, vec![event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    let MessageContent::MiniApp(content) = &message.content else {
        panic!("Expected a mini app: {:?}", message.content);
    };
    content
        .button_rows
        .iter()
        .map(|row| row.iter().map(|b| b.id.clone()).collect())
        .collect()
}
