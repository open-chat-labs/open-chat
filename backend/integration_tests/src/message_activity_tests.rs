use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use event_store_canister::TimestampMillis;
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_message_id, random_string};
use types::{Chat, ChatType, Cryptocurrency, MessageContentInitial, TextContent};
use user_canister::MessageActivity;

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn react_to_users_message_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let text = "Hello World";
    let message_id = random_message_id();
    let reaction = "😀";

    // Send a text message from us then they react to it
    match chat {
        Chat::Direct(_) => {
            client::user::happy_path::send_text_message(env, &us, them.user_id, text, Some(message_id));
            client::user::happy_path::add_reaction(env, &them, us.user_id, reaction, message_id);
        }
        Chat::Group(group_id) => {
            client::group::happy_path::send_text_message(env, &us, group_id, None, text, Some(message_id));
            client::group::happy_path::add_reaction(env, &them, group_id, reaction, message_id);
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_text_message(env, &us, community_id, channel_id, None, text, Some(message_id));
            client::community::happy_path::add_reaction(env, &them, community_id, channel_id, reaction, message_id);
        }
    };

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::Reaction);
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn mention_user_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let text = format!("Hello @UserId({})!", us.user_id);
    let message_id = random_message_id();
    let content = MessageContentInitial::Text(TextContent { text });
    let mentioned = vec![(&us).into()];

    // Send a message from them mentioning us
    match chat {
        Chat::Direct(_) => unreachable!(),
        Chat::Group(group_id) => {
            client::group::send_message_v2(
                env,
                them.principal,
                group_id.into(),
                &group_canister::send_message_v2::Args {
                    thread_root_message_index: None,
                    message_id,
                    content,
                    sender_name: them.username(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned,
                    forwarding: false,
                    block_level_markdown: false,
                    rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                    correlation_id: 0,
                },
            );
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::send_message(
                env,
                them.principal,
                community_id.into(),
                &community_canister::send_message::Args {
                    channel_id,
                    thread_root_message_index: None,
                    message_id: random_message_id(),
                    content,
                    sender_name: them.username(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned,
                    forwarding: false,
                    block_level_markdown: false,
                    community_rules_accepted: None,
                    channel_rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                },
            );
        }
    }

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::Mention);
}

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn tip_users_message_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let text = "Hello World";
    let message_id = random_message_id();

    // Send a text message from us then they tip it
    match chat {
        Chat::Direct(_) => {
            client::user::happy_path::send_text_message(env, &us, them.user_id, text, Some(message_id));
            // Allow message to reach their user canister
            tick_many(env, 2);
        }
        Chat::Group(group_id) => {
            client::group::happy_path::send_text_message(env, &us, group_id, None, text, Some(message_id));
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_text_message(env, &us, community_id, channel_id, None, text, Some(message_id));
        }
    };

    client::user::happy_path::tip_message(
        env,
        &them,
        us.user_id,
        chat,
        message_id,
        canister_ids.icp_ledger,
        Cryptocurrency::InternetComputer,
        10_000_000,
    );

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::Tip);
}

// #[test_case(ChatType::Direct)]
// #[test_case(ChatType::Group)]
// #[test_case(ChatType::Channel)]
// fn multiple_events_on_one_message_and_check_activity_feed(chat_type: ChatType) {
// }

// #[test]
// fn mark_activity_feed_read_and_check_user_updates() {}

fn check_updates(env: &mut PocketIc, start: TimestampMillis, us: &User, them: &User, expected_activity: MessageActivity) {
    assert!(client::user::happy_path::updates(env, us, start).map_or(false, |result| result.message_activity_summary.is_some()));

    let feed = client::user::happy_path::message_activity_feed(env, us, start);
    assert_eq!(feed.total, 1);
    assert_eq!(feed.events.len(), 1);

    let event = &feed.events[0];
    assert_eq!(event.activity, expected_activity);
    assert_eq!(event.user_id, them.user_id);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, chat_type: ChatType) -> TestData {
    let owner = client::register_diamond_user(env, canister_ids, controller);
    let us = client::register_user(env, canister_ids);
    let them = client::register_diamond_user(env, canister_ids, controller);

    let chat = match chat_type {
        ChatType::Direct => Chat::Direct(us.user_id.into()),
        ChatType::Group => {
            let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
            client::local_user_index::happy_path::join_group(env, us.principal, canister_ids.local_user_index, group_id);
            client::local_user_index::happy_path::join_group(env, them.principal, canister_ids.local_user_index, group_id);
            Chat::Group(group_id)
        }
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            client::local_user_index::happy_path::join_channel(
                env,
                us.principal,
                canister_ids.local_user_index,
                community_id,
                channel_id,
            );
            client::local_user_index::happy_path::join_channel(
                env,
                them.principal,
                canister_ids.local_user_index,
                community_id,
                channel_id,
            );
            Chat::Channel(community_id, channel_id)
        }
    };

    TestData { them, us, chat }
}

struct TestData {
    them: User,
    us: User,
    chat: Chat,
}
