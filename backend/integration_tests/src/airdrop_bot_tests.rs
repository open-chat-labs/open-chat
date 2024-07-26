use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use airdrop_bot_canister::set_airdrop;
use std::ops::Deref;
use std::time::Duration;
use types::{AccessGate, ChatEvent, EventIndex, GroupRole, Message, MessageContent, UserId};
use utils::time::MonthKey;

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
    // Create 1 owner and 5 other users
    // Owner creates the airdrop community
    // Join each other user to the community
    // Owner creates a public airdrop channel gated by diamond - the 5 users will be added automatically
    // Transfer 85,001 CHAT to the airdrop_bot canister
    // Owner invites the airdrop_bot to the channel
    //
    let airdrop_bot_user_id: UserId = canister_ids.airdrop_bot.into();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let community_id =
        client::user::happy_path::create_community(env, &owner, "CHIT for CHAT airdrops", true, vec!["General".to_string()]);

    let users: Vec<_> = (0..5)
        .map(|_| client::register_diamond_user(env, canister_ids, *controller))
        .collect();

    env.tick();

    for user in users {
        client::local_user_index::happy_path::join_community(env, user.principal, canister_ids.local_user_index, community_id);
    }

    tick_many(env, 10);

    let channel_id = client::community::happy_path::create_gated_channel(
        env,
        owner.principal,
        community_id,
        true,
        "July airdrop".to_string(),
        AccessGate::DiamondMember,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        canister_ids.airdrop_bot,
        8_500_100_000_000,
    );

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &owner,
        canister_ids.local_user_index,
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

    let response = client::airdrop_bot::set_airdrop(
        env,
        *controller,
        canister_ids.airdrop_bot,
        &airdrop_bot_canister::set_airdrop::Args {
            community_id,
            channel_id,
            start: start_airdrop,
            main_chat_fund: 6_500_000_000_000,
            main_chit_band: 500,
            lottery_prizes: vec![1_200_000_000_000, 500_000_000_000, 300_000_000_000],
            lottery_chit_band: 500,
        },
    );

    assert!(matches!(response, set_airdrop::Response::Success));

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
    env.advance_time(Duration::from_millis(1000 + start_airdrop - now_millis(env)));

    tick_many(env, 10);

    // Assert the channel is now locked
    //
    let channel_summary = client::community::happy_path::channel_summary(env, &owner, community_id, channel_id);
    assert_eq!(channel_summary.gate, Some(AccessGate::Locked));

    // Assert the airdrop channel has exactly 3 prize messages
    //
    let response =
        client::community::happy_path::events(env, &owner, community_id, channel_id, EventIndex::from(0), true, 10, 10);

    let messages: Vec<Message> = response
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(message) = e.event { Some(*message) } else { None })
        .collect();

    assert_eq!(messages.len(), 3);
    assert!(messages.iter().all(|m| matches!(m.content, MessageContent::Crypto(_))));

    // Assert the diamond user has been sent a DM from the Airdrop Bot for the expected amount of CHAT
    //
    let response = client::user::happy_path::events(env, &owner, airdrop_bot_user_id, EventIndex::from(0), true, 10, 20);

    let messages: Vec<Message> = response
        .events
        .into_iter()
        .filter_map(|e| if let ChatEvent::Message(message) = e.event { Some(*message) } else { None })
        .collect();

    assert_eq!(messages.len(), 1);

    let MessageContent::Crypto(content) = &messages[0].content else {
        panic!("unexpected content: {messages:?}");
    };

    // Owner should have 5000 CHIT from diamond achievement.
    // Other 5 users should have 5500 CHIT each from joining community achievement
    // Each share = ((5500 * 5 + 5000) / 500) = 1_000
    // Owner's shares = 5000/500 = 10
    // Expected CHAT = 10_000
    assert_eq!(content.transfer.units(), 1_000_000_000_000);
}
