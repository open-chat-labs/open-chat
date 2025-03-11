use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use airdrop_bot_canister::{AirdropAlgorithm, V1Algorithm, V2Algorithm};
use itertools::Itertools;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{AccessGate, ChatEvent, CryptoContent, EventIndex, GroupRole, Message, MessageContent, UserId};
use utils::time::MonthKey;

#[test_case(true)]
#[test_case(false)]
fn airdrop_end_to_end(v2: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Setup the environment for the test...
    // Create 1 owner and 5 other users
    // Owner creates the airdrop community
    // Join other users to the community
    // Owner creates a public airdrop channel gated by diamond
    // The users join the channel
    // Transfer 63,001 CHAT to the airdrop_bot canister
    // Owner invites the airdrop_bot to the channel
    //
    let airdrop_bot_user_id: UserId = canister_ids.airdrop_bot.into();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);

    let users: Vec<_> = (0..5)
        .map(|_| client::register_diamond_user(env, canister_ids, *controller))
        .collect();

    env.tick();

    let channel_id = client::community::happy_path::create_gated_channel(
        env,
        owner.principal,
        community_id,
        true,
        "July airdrop".to_string(),
        AccessGate::DiamondMember,
    );

    for user in users.iter() {
        client::community::happy_path::join_channel(env, user.principal, community_id, channel_id);
    }

    tick_many(env, 10);

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        canister_ids.airdrop_bot,
        6_300_100_000_000,
    );

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &owner,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![airdrop_bot_user_id],
    );

    // Set the airdrop to start just after the beginning of the next month
    // This will also join the airdrop_bot to the channel
    //
    let airdrop_month = MonthKey::from_timestamp(now_millis(env));
    let next_month = airdrop_month.next();
    let start_airdrop = next_month.start_timestamp() + 10000;

    let algorithm = if v2 {
        AirdropAlgorithm::V2(V2Algorithm {
            main_chat_fund: 5_500_000_000_000,
            main_chit_band: 500,
            lottery_prizes: vec![200_000_000_000, 200_000_000_000, 200_000_000_000, 200_000_000_000],
            lottery_min_chit: 500,
            lottery_min_streak: 30,
            min_minutes_online: 0,
        })
    } else {
        AirdropAlgorithm::V1(V1Algorithm {
            main_chat_fund: 5_500_000_000_000,
            main_chit_band: 500,
            lottery_prizes: vec![500_000_000_000, 200_000_000_000, 100_000_000_000],
            lottery_chit_band: 500,
        })
    };

    let response = client::airdrop_bot::set_airdrop(
        env,
        *controller,
        canister_ids.airdrop_bot,
        &airdrop_bot_canister::set_airdrop::Args {
            community_id,
            channel_id,
            start: start_airdrop,
            algorithm,
        },
    );

    assert!(matches!(response, airdrop_bot_canister::set_airdrop::Response::Success));

    tick_many(env, 3);

    // Make the airdrop_bot user an owner of the channel
    //
    client::community::happy_path::change_channel_role(
        env,
        owner.principal,
        community_id,
        channel_id,
        airdrop_bot_user_id,
        GroupRole::Owner,
    );

    // Advance time to just after the airdrop is due
    env.advance_time(Duration::from_millis(1000 + start_airdrop.saturating_sub(now_millis(env))));

    tick_many(env, 30);

    // Assert the channel is now locked
    //
    let channel_summary = client::community::happy_path::channel_summary(env, &owner, community_id, channel_id);
    assert_eq!(channel_summary.gate, Some(AccessGate::Locked));

    // Assert the airdrop channel has messages with the correct prizes in reverse order
    //
    let response =
        client::community::happy_path::events(env, &owner, community_id, channel_id, EventIndex::from(0), true, 10, 10);

    let contents: Vec<CryptoContent> = response
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(message) = e.event { Some(*message) } else { None })
        .filter_map(|m| if let MessageContent::Crypto(content) = m.content { Some(content) } else { None })
        .collect();

    if v2 {
        assert_eq!(contents.len(), 4);
        assert_eq!(contents[0].transfer.units(), 200_000_000_000);
        assert_eq!(contents[1].transfer.units(), 200_000_000_000);
        assert_eq!(contents[2].transfer.units(), 200_000_000_000);
        assert_eq!(contents[3].transfer.units(), 200_000_000_000);
    } else {
        assert_eq!(contents.len(), 3);
        let units: Vec<_> = contents.iter().map(|c| c.transfer.units()).sorted().collect();
        assert_eq!(units[0], 100_000_000_000);
        assert_eq!(units[1], 200_000_000_000);
        assert_eq!(units[2], 500_000_000_000);
    }

    // Assert user1 has been sent a DM from the Airdrop Bot for the expected amount of CHAT
    //
    let response = client::user::happy_path::events(env, &users[0], airdrop_bot_user_id, EventIndex::from(0), true, 10, 20);

    let messages: Vec<Message> = response
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(message) = e.event { Some(*message) } else { None })
        .collect();

    assert_eq!(messages.len(), 1);

    let MessageContent::Crypto(content) = &messages[0].content else {
        panic!("unexpected content: {messages:?}");
    };

    // 5 users should have 5500 CHIT each from achievements
    // Total shares = ((5500 * 5) / 500) = 55
    // Each share = 55_000 CHAT / 55 = 1_000 CHAT
    // Expected CHAT per user = 11_000
    assert_eq!(content.transfer.units(), 1_100_000_000_000);
}
