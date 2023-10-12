use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use types::{Chat, ChatEvent, Cryptocurrency};

#[test]
fn tip_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let message_id = random_message_id();
    let tip_amount = 1_0000_0000;

    let event_index =
        client::user::happy_path::send_text_message(env, &user2, user1.user_id, "TEXT", Some(message_id)).event_index;

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Direct(user2.user_id.into()),
        message_id,
        canister_ids.icp_ledger,
        Cryptocurrency::InternetComputer,
        tip_amount,
        Cryptocurrency::InternetComputer.fee().unwrap(),
    );

    let user1_message = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(user1_message.tips.len(), 1);
    assert_eq!(
        *user1_message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_message = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(user2_message.tips.len(), 1);
    assert_eq!(
        *user2_message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
    assert_eq!(user2_balance as u128, tip_amount);
}

#[test]
fn tip_group_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let message_id = random_message_id();
    let tip_amount = 1_0000_0000;

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let event_index =
        client::group::happy_path::send_text_message(env, &user2, group_id, None, random_string(), Some(message_id))
            .event_index;

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Group(group_id),
        message_id,
        canister_ids.icp_ledger,
        Cryptocurrency::InternetComputer,
        tip_amount,
        Cryptocurrency::InternetComputer.fee().unwrap(),
    );

    let message = client::group::happy_path::events_by_index(env, &user2, group_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
    assert_eq!(user2_balance as u128, tip_amount);
}

#[test]
fn tip_channel_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let message_id = random_message_id();
    let tip_amount = 1_0000_0000;

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    let event_index = client::community::happy_path::send_text_message(
        env,
        &user2,
        community_id,
        channel_id,
        None,
        random_string(),
        Some(message_id),
    )
    .event_index;

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Channel(community_id, channel_id),
        message_id,
        canister_ids.icp_ledger,
        Cryptocurrency::InternetComputer,
        tip_amount,
        Cryptocurrency::InternetComputer.fee().unwrap(),
    );

    let message = client::community::happy_path::events_by_index(env, &user2, community_id, channel_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
    assert_eq!(user2_balance as u128, tip_amount);
}

#[test]
fn tip_group_message_retries_if_c2c_call_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let message_id = random_message_id();
    let tip_amount = 1_0000_0000;

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let event_index =
        client::group::happy_path::send_text_message(env, &user2, group_id, None, random_string(), Some(message_id))
            .event_index;

    env.stop_canister(group_id.into(), Some(canister_ids.local_group_index))
        .unwrap();

    let tip_message_response = client::user::tip_message(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::tip_message::Args {
            chat: Chat::Group(group_id),
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            ledger: canister_ids.icp_ledger,
            token: Cryptocurrency::InternetComputer,
            amount: tip_amount,
            fee: Cryptocurrency::InternetComputer.fee().unwrap(),
        },
    );

    assert!(matches!(
        tip_message_response,
        user_canister::tip_message::Response::Retrying(_)
    ));

    env.tick();
    env.start_canister(group_id.into(), Some(canister_ids.local_group_index))
        .unwrap();
    env.advance_time(Duration::from_secs(10));
    env.tick();

    let message = client::group::happy_path::events_by_index(env, &user2, group_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );
}

#[test]
fn tip_channel_message_retries_if_c2c_call_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let message_id = random_message_id();
    let tip_amount = 1_0000_0000;

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    let event_index = client::community::happy_path::send_text_message(
        env,
        &user2,
        community_id,
        channel_id,
        None,
        random_string(),
        Some(message_id),
    )
    .event_index;

    env.stop_canister(community_id.into(), Some(canister_ids.local_group_index))
        .unwrap();

    let tip_message_response = client::user::tip_message(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::tip_message::Args {
            chat: Chat::Channel(community_id, channel_id),
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            ledger: canister_ids.icp_ledger,
            token: Cryptocurrency::InternetComputer,
            amount: tip_amount,
            fee: Cryptocurrency::InternetComputer.fee().unwrap(),
        },
    );

    assert!(matches!(
        tip_message_response,
        user_canister::tip_message::Response::Retrying(_)
    ));

    env.tick();
    env.start_canister(community_id.into(), Some(canister_ids.local_group_index))
        .unwrap();
    env.advance_time(Duration::from_secs(10));
    env.tick();

    let message = client::community::happy_path::events_by_index(env, &user2, community_id, channel_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::icrc1::happy_path::transfer(
        env,
        controller,
        canister_ids.icp_ledger,
        user1.user_id.into(),
        10_000_000_000u64,
    );

    TestData { user1, user2 }
}

struct TestData {
    user1: User,
    user2: User,
}
