use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use event_store_canister::TimestampMillis;
use pocket_ic::PocketIc;
use std::collections::HashMap;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_message_id, random_string};
use types::{
    Chat, ChatType, CryptoContent, CryptoTransaction, Cryptocurrency, GroupReplyContext, MessageContentInitial,
    P2PSwapContentInitial, PendingCryptoTransaction, PollConfig, PollContent, PollVotes, TextContent, TotalVotes,
};
use user_canister::MessageActivity;
use utils::time::DAY_IN_MS;

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn react_to_message_and_check_activity_feed(chat_type: ChatType) {
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
fn tip_message_and_check_activity_feed(chat_type: ChatType) {
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

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn send_crypto_message_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let amount = 1_000_000;

    // They send us a crypto message
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, them.user_id, amount);

    let transaction = PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
        ledger: canister_ids.icp_ledger,
        fee: 10_000,
        token: Cryptocurrency::InternetComputer,
        amount,
        to: us.user_id.into(),
        memo: None,
        created: now_nanos(env),
    });

    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: us.user_id,
        transfer: CryptoTransaction::Pending(transaction),
        caption: None,
    });

    match chat {
        Chat::Direct(_) => {
            client::user::happy_path::send_message(env, &them, us.user_id, None, content, None, None);
        }
        Chat::Group(group_id) => {
            client::group::happy_path::send_message_with_transfer(env, group_id, &them, content, None);
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_message_with_transfer(env, community_id, channel_id, &them, content, None);
        }
    };

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::Crypto);
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn quote_reply_to_message_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let text = "Hello World";
    let content = MessageContentInitial::Text(TextContent { text: text.to_string() });

    match chat {
        Chat::Direct(_) => unreachable!(),
        Chat::Group(group_id) => {
            let result = client::group::happy_path::send_text_message(env, &us, group_id, None, text, None);
            client::group::happy_path::send_message(
                env,
                &them,
                group_id,
                None,
                content,
                Some(GroupReplyContext {
                    event_index: result.event_index,
                }),
                None,
            );
        }
        Chat::Channel(community_id, channel_id) => {
            let result = client::community::happy_path::send_text_message(env, &us, community_id, channel_id, None, text, None);
            client::community::happy_path::send_message(
                env,
                &them,
                community_id,
                channel_id,
                None,
                content,
                Some(GroupReplyContext {
                    event_index: result.event_index,
                }),
                None,
            );
        }
    };

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::QuoteReply);
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn thread_reply_to_message_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let text = "Hello World";
    match chat {
        Chat::Direct(_) => unreachable!(),
        Chat::Group(group_id) => {
            let result = client::group::happy_path::send_text_message(env, &us, group_id, None, text, None);
            client::group::happy_path::send_text_message(env, &them, group_id, Some(result.message_index), text, None);
        }
        Chat::Channel(community_id, channel_id) => {
            let result = client::community::happy_path::send_text_message(env, &us, community_id, channel_id, None, text, None);
            client::community::happy_path::send_text_message(
                env,
                &them,
                community_id,
                channel_id,
                Some(result.message_index),
                text,
                None,
            );
        }
    };

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::ThreadReply);
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn vote_on_poll_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    let content = MessageContentInitial::Poll(PollContent {
        config: PollConfig {
            text: Some("Pick one".to_string()),
            options: vec!["a".to_string(), "b".to_string(), "c".to_string()],
            end_date: None,
            anonymous: false,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: false,
            allow_user_to_change_vote: false,
        },
        votes: PollVotes {
            total: TotalVotes::Visible(HashMap::new()),
            user: Vec::new(),
        },
        ended: false,
    });

    match chat {
        Chat::Direct(_) => unreachable!(),
        Chat::Group(group_id) => {
            let result = client::group::happy_path::send_message(env, &us, group_id, None, content, None, None);
            client::group::happy_path::register_poll_vote(env, &them, group_id, result.message_index, 0);
        }
        Chat::Channel(community_id, channel_id) => {
            let result =
                client::community::happy_path::send_message(env, &us, community_id, channel_id, None, content, None, None);
            client::community::happy_path::register_poll_vote(env, &them, community_id, channel_id, result.message_index, 0);
        }
    };

    tick_many(env, 3);

    check_updates(env, 0, &us, &them, MessageActivity::PollVote);
}

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn accept_p2p_swap_and_check_activity_feed(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, chat_type);

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Principal::from(us.user_id),
        1_100_000_000,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(them.user_id),
        11_000_000_000,
    );

    let message_id = random_message_id();
    let content = MessageContentInitial::P2PSwap(P2PSwapContentInitial {
        token0: Cryptocurrency::InternetComputer.try_into().unwrap(),
        token0_amount: 1_000_000_000,
        token1: Cryptocurrency::CHAT.try_into().unwrap(),
        token1_amount: 10_000_000_000,
        expires_in: DAY_IN_MS,
        caption: None,
    });

    match chat {
        Chat::Direct(_) => {
            client::user::happy_path::send_message(env, &us, them.user_id, None, content, None, Some(message_id));
            client::user::happy_path::accept_p2p_swap(env, &them, us.user_id, message_id);
        }
        Chat::Group(group_id) => {
            client::group::happy_path::send_message_with_transfer(env, group_id, &us, content, Some(message_id));
            client::group::happy_path::accept_p2p_swap(env, &them, group_id, message_id);
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::send_message_with_transfer(
                env,
                community_id,
                channel_id,
                &us,
                content,
                Some(message_id),
            );
            client::community::happy_path::accept_p2p_swap(env, &them, community_id, channel_id, message_id);
        }
    }

    tick_many(env, 10);

    check_updates(env, 0, &us, &them, MessageActivity::P2PSwapAccepted);
}

#[test]
fn mark_activity_feed_read_and_check_user_updates() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { them, us, chat } = init_test_data(env, canister_ids, *controller, ChatType::Group);

    let Chat::Group(group_id) = chat else {
        unreachable!();
    };

    let text = "Hello World";
    let result = client::group::happy_path::send_text_message(env, &us, group_id, None, text, None);
    client::group::happy_path::send_text_message(env, &them, group_id, Some(result.message_index), text, None);

    tick_many(env, 3);

    env.advance_time(Duration::from_millis(1));
    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));

    client::user::mark_message_activity_feed_read(
        env,
        us.principal,
        us.canister(),
        &user_canister::mark_message_activity_feed_read::Args { read_up_to: start },
    );

    let Some(summary) = client::user::happy_path::updates(env, &us, start).and_then(|result| result.message_activity_summary)
    else {
        panic!("Expected updates");
    };

    assert_eq!(summary.unread_count, 0);
    assert_eq!(summary.read_up_to, start);
}

#[test_case(ChatType::Direct)]
#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn multiple_events_on_one_message_and_check_activity_feed(chat_type: ChatType) {
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

    assert!(client::user::happy_path::updates(env, &us, 0).map_or(false, |result| result.message_activity_summary.is_some()));

    let feed = client::user::happy_path::message_activity_feed(env, &us, 0);
    assert_eq!(feed.total, 2);
    assert_eq!(feed.events.len(), 2);

    let event = &feed.events[0];
    assert_eq!(event.activity, MessageActivity::Tip);
    assert_eq!(event.user_id, Some(them.user_id));

    let event = &feed.events[1];
    assert_eq!(event.activity, MessageActivity::Reaction);
    assert_eq!(event.user_id, Some(them.user_id));
}

fn check_updates(env: &mut PocketIc, start: TimestampMillis, us: &User, them: &User, expected_activity: MessageActivity) {
    assert!(client::user::happy_path::updates(env, us, start).map_or(false, |result| result.message_activity_summary.is_some()));

    let feed = client::user::happy_path::message_activity_feed(env, us, start);
    assert_eq!(feed.total, 1);
    assert_eq!(feed.events.len(), 1);

    let event = &feed.events[0];
    assert_eq!(event.activity, expected_activity);
    assert_eq!(event.user_id, Some(them.user_id));
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
