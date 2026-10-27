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
    ChatEvent, ChatPermission, CommunityId, MessageContent, MessageContentInitial, MessagePermission, PriceChartContent,
    PriceChartSeries, PriceChartSource, PriceChartToken,
};

#[test]
fn a_bot_with_the_image_permission_posts_a_price_chart_which_members_read() {
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
    } = setup(env, canister_ids, *controller);
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::Image,
    );

    let response = send_chart(env, bot_principal, local_user_index, Chat::Channel(community_id, channel_id));
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    tick_many(env, 3);

    let events =
        client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![result.event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    let MessageContent::PriceChart(content) = &message.content else {
        panic!("Expected a price chart: {:?}", message.content);
    };
    assert_eq!(content.title, "ADA · 1 day");
    assert_eq!(content.series[0].points, [(1_000, 0.5), (2_000, 0.25)]);
}

#[test]
fn a_bot_without_the_image_permission_cant_post_a_price_chart() {
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
    } = setup(env, canister_ids, *controller);
    let bot_principal = install_bot(
        env,
        &owner,
        canister_ids.user_index,
        local_user_index,
        community_id,
        MessagePermission::Text,
    );

    let response = send_chart(env, bot_principal, local_user_index, Chat::Channel(community_id, channel_id));
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Error(_)),
        "Expected an error: {response:?}"
    );
}

#[test]
fn a_member_can_forward_a_price_chart_but_not_post_one() {
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

    let send = |env: &mut PocketIc, forwarding: bool| {
        client::community::send_message(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::send_message::Args {
                channel_id,
                thread_root_message_index: None,
                message_id: random_from_u128(),
                content: MessageContentInitial::PriceChart(chart()),
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
        )
    };

    let posted = send(env, false);
    assert!(
        matches!(posted, community_canister::send_message::Response::Error(_)),
        "Expected an error: {posted:?}"
    );

    let forwarded = send(env, true);
    assert!(
        matches!(forwarded, community_canister::send_message::Response::Success(_)),
        "'send_message' error: {forwarded:?}"
    );
}

struct Setup {
    owner: User,
    community_id: CommunityId,
    channel_id: ChannelId,
    local_user_index: CanisterId,
}

fn setup(env: &mut PocketIc, canister_ids: &crate::CanisterIds, controller: Principal) -> Setup {
    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let local_user_index = canister_ids.local_user_index(env, community_id);
    Setup {
        owner,
        community_id,
        channel_id,
        local_user_index,
    }
}

// A bot asking to send text and images autonomously, installed in the community with `granted`
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
            .with_message(&HashSet::from_iter([MessagePermission::Text, MessagePermission::Image]))
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

fn send_chart(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
) -> local_user_index_canister::bot_send_message::Response {
    client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::PriceChart(chart()),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    )
}

fn chart() -> PriceChartContent {
    PriceChartContent {
        title: "ADA · 1 day".to_string(),
        start: 1_000,
        end: 3_000,
        series: vec![PriceChartSeries {
            token: PriceChartToken::Coin("cardano".to_string()),
            symbol: "ADA".to_string(),
            name: "Cardano".to_string(),
            points: vec![(1_000, 0.5), (2_000, 0.25)],
        }],
        sources: vec![PriceChartSource {
            name: "CoinGecko".to_string(),
            url: "https://www.coingecko.com".to_string(),
        }],
    }
}
