use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::now_nanos;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_ledger_types::Tokens;
use ic_test_state_machine_client::StateMachine;
use ledger_utils::create_pending_transaction;
use std::ops::Deref;
use types::{
    ChannelId, ChatEvent, CommunityId, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent, MessageContentInitial,
};

#[test]
fn send_text_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let result =
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, "Hello, world!", None);

    let events_response =
        client::community::happy_path::events_by_index(env, &user2, community_id, channel_id, vec![result.event_index]);

    if let ChatEvent::Message(message) = &events_response.events[0].event {
        if let MessageContent::Text(content) = &message.content {
            assert_eq!(content.text, "Hello, world!");
        } else {
            panic!("Expected a text message");
        }
    } else {
        panic!("Expected a message event");
    }
}

#[test]
fn send_crypto_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let send_message_result = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    Tokens::from_e8s(10000),
                    user2.user_id,
                    now_nanos(env),
                )),
                caption: None,
            }),
            sender_name: user1.username(),
            replies_to: None,
            mentioned: Vec::new(),
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ) {
        let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
        assert_eq!(user2_balance, 10000);
    } else {
        panic!("{send_message_result:?}")
    }
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);
    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    env.tick();

    let summary = client::community::happy_path::summary(env, &user2, community_id);
    let channel_id = summary.channels.iter().find(|c| c.name == "general").unwrap().channel_id;

    TestData {
        user1,
        user2,
        community_id,
        channel_id,
    }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
