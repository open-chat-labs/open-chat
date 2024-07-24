use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use airdrop_bot_canister::set_airdrop;
use std::ops::Deref;
use std::time::Duration;
use types::{AccessGate, ChatEvent, EventIndex, GroupRole, Message, MessageContent};

#[test]
fn airdrop_end_to_end() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Setup the environment for the test...
    // Create a diamond user and it then creates an airdrop community
    // Create 5 more users and join each of them to the community
    // Create a public airdrop channel - the 5 users + diamond user will be added automatically
    // Transfer 80,001 CHAT to the airdrop_bot canister
    //
    let diamond_user = client::register_diamond_user(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(
        env,
        &diamond_user,
        "CHIT for CHAT airdrops",
        true,
        vec!["General".to_string()],
    );

    let user_count = 5usize;
    let users: Vec<_> = (0..user_count).map(|_| client::register_user(env, canister_ids)).collect();

    env.tick();

    for user in users {
        client::local_user_index::happy_path::join_community(env, user.principal, canister_ids.local_user_index, community_id);
    }

    tick_many(env, 10);

    let channel_id = client::community::happy_path::create_channel(
        env,
        diamond_user.principal,
        community_id,
        true,
        "July airdrop".to_string(),
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        canister_ids.airdrop_bot,
        8_000_100_000_000,
    );

    // Set the airdrop to start in 1 second and assert success
    // This will also join the airdrop_bot to the channel
    //
    let response = client::airdrop_bot::set_airdrop(
        env,
        *controller,
        canister_ids.airdrop_bot,
        &airdrop_bot_canister::set_airdrop::Args {
            community_id,
            channel_id,
            start: now_millis(env) + 1000,
            main_chat_fund: 60_000,
            main_chit_band: 500,
            lottery_prizes: vec![12_000, 5_000, 3_000],
            lottery_chit_band: 500,
        },
    );

    assert!(matches!(response, set_airdrop::Response::Success));

    tick_many(env, 3);

    // Make the airdrop_bot user an owner of the channel
    //
    client::community::happy_path::change_channel_role(
        env,
        diamond_user.principal,
        community_id,
        channel_id,
        canister_ids.airdrop_bot.into(),
        GroupRole::Owner,
    );

    // Advance time by a second to start the airdrop
    env.advance_time(Duration::from_millis(1010));
    tick_many(env, 10);

    // Assert the channel is now locked
    //
    let channel_summary = client::community::happy_path::channel_summary(env, &diamond_user, community_id, channel_id);
    assert_eq!(channel_summary.gate, Some(AccessGate::Locked));

    // Assert the airdrop channel has exactly 3 prize messages
    //
    let response = client::community::happy_path::events(
        env,
        &diamond_user,
        community_id,
        channel_id,
        EventIndex::from(0),
        true,
        10,
        10,
    );

    let messages: Vec<Message> = response
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(message) = e.event { Some(*message) } else { None })
        .collect();

    assert_eq!(messages.len(), 3);
    assert!(messages.iter().all(|m| matches!(m.content, MessageContent::Crypto(_))));

    // Assert the diamond user has been sent a DM from the Airdrop Bot for the expected amount of CHAT
    //
    let response = client::user::happy_path::events(
        env,
        &diamond_user,
        canister_ids.airdrop_bot.into(),
        EventIndex::from(0),
        true,
        10,
        20,
    );

    assert_eq!(response.events.len(), 1);

    let ChatEvent::Message(message) = &response.events[0].event else {
        panic!("unexpected event: {response:?}");
    };

    let MessageContent::Crypto(content) = &message.content else {
        panic!("unexpected content: {response:?}");
    };

    // Diamond user should have 5000 CHIT from diamond achievement.
    // Other 5 users should have 500 CHIT each from joining community achievement
    // Expected CHAT = 60_000 / (7_500 / 500) = 4_000
    assert_eq!(content.transfer.units(), 400_000_000_000);
}
