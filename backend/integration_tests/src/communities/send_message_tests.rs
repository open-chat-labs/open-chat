use crate::client::ledger::happy_path::balance_of;
use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ledger_utils::create_pending_transaction;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    CanisterId, ChannelId, ChatEvent, CommunityId, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent,
    MessageContentInitial, OptionUpdate, PrizeContentInitial, TextContent, UpdatedRules, Version,
};
use utils::consts::PRIZE_FEE_PERCENT;

#[test]
fn send_text_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
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

#[test_case(false)]
#[test_case(true)]
fn send_crypto_in_channel(with_c2c_error: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    if with_c2c_error {
        stop_canister(env, canister_ids.local_group_index, community_id.into());
    }

    let send_message_result = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    canister_ids.icp_ledger,
                    10000,
                    10000,
                    user2.user_id,
                    None,
                    now_nanos(env),
                )),
                caption: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    if with_c2c_error {
        assert!(matches!(
            send_message_result,
            user_canister::send_message_with_transfer_to_channel::Response::Retrying(..)
        ));
    } else {
        assert!(matches!(
            send_message_result,
            user_canister::send_message_with_transfer_to_channel::Response::Success(_)
        ));
    }

    let user2_balance = balance_of(env, canister_ids.icp_ledger, user2.user_id);
    assert_eq!(user2_balance, 10000);

    if with_c2c_error {
        env.advance_time(Duration::from_secs(10));
        start_canister(env, canister_ids.local_group_index, community_id.into());
        env.tick();
    }

    let event = client::community::happy_path::events(env, &user2, community_id, channel_id, 0.into(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(m) = event {
        assert!(matches!(m.content, MessageContent::Crypto(_)));
    } else {
        panic!("{event:?}");
    }
}

#[test]
fn send_prize_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let initial_user1_balance = balance_of(env, canister_ids.icp_ledger, user1.canister());
    let fee = 10000;
    let prizes = vec![100000];
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);

    let transfer_to: CanisterId = community_id.into();
    let send_message_result = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Prize(PrizeContentInitial {
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    canister_ids.icp_ledger,
                    amount,
                    fee,
                    transfer_to.into(),
                    None,
                    now_nanos(env),
                )),
                caption: None,
                prizes_v2: prizes,
                end_date: now_millis(env) + 1000,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ) {
        let user1_balance_after_sending_prize = balance_of(env, canister_ids.icp_ledger, user1.canister());
        assert_eq!(user1_balance_after_sending_prize, initial_user1_balance - amount - fee);

        let community_balance_after_sending_prize = balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
        assert_eq!(community_balance_after_sending_prize, amount);

        env.advance_time(Duration::from_secs(2));
        tick_many(env, 5);

        let user1_balance_after_refund = balance_of(env, canister_ids.icp_ledger, user1.canister());
        assert_eq!(user1_balance_after_refund, initial_user1_balance - 2 * fee);

        let community_balance_after_refund = balance_of(env, canister_ids.icp_ledger, Principal::from(community_id));
        assert_eq!(community_balance_after_refund, 0);
    } else {
        panic!("{send_message_result:?}")
    }
}

#[test]
fn send_message_with_community_rules_not_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, None);

    if !matches!(
        response,
        community_canister::send_message::Response::CommunityRulesNotAccepted
    ) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_channel_rules_not_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, None);

    if !matches!(response, community_canister::send_message::Response::RulesNotAccepted) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_community_rules_accepted_succeeds() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, Some(Version::from(1)), None);

    if !matches!(response, community_canister::send_message::Response::Success(_)) {
        panic!("'send_message' error {response:?}");
    }
}

#[test]
fn send_message_with_channel_rules_accepted_succeeds() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, Some(Version::from(1)));

    if !matches!(response, community_canister::send_message::Response::Success(_)) {
        panic!("'send_message' error {response:?}");
    }
}

#[test]
fn send_message_with_community_rules_but_not_channel_rules_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());
    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, Some(Version::from(1)), None);

    if !matches!(response, community_canister::send_message::Response::RulesNotAccepted) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_channel_rules_but_not_community_rules_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());
    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, Some(Version::from(1)));

    if !matches!(
        response,
        community_canister::send_message::Response::CommunityRulesNotAccepted
    ) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_community_rules_and_channel_rules_accepted_succeeds() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());
    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    let response = send_dummy_message_with_rules(
        env,
        &user2,
        community_id,
        channel_id,
        Some(Version::from(1)),
        Some(Version::from(1)),
    );

    if !matches!(response, community_canister::send_message::Response::Success(_)) {
        panic!("'send_message' error {response:?}");
    }
}

#[test]
fn send_message_with_previously_accepted_rules_succeeds() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());
    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());

    send_dummy_message_with_rules(
        env,
        &user2,
        community_id,
        channel_id,
        Some(Version::from(1)),
        Some(Version::from(1)),
    );

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, None);

    if !matches!(response, community_canister::send_message::Response::Success(_)) {
        panic!("'send_message' error {response:?}");
    }
}

#[test]
fn send_message_with_old_community_rules_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_community_rules(env, user1.principal, community_id, "No heavy petting".to_string());
    set_community_rules(env, user1.principal, community_id, "No heavy petting or pets".to_string());

    let response = send_dummy_message_with_rules(
        env,
        &user2,
        community_id,
        channel_id,
        Some(Version::from(1)),
        Some(Version::from(1)),
    );

    if !matches!(
        response,
        community_canister::send_message::Response::CommunityRulesNotAccepted
    ) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_old_channel_rules_accepted_fails() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    set_channel_rules(env, user1.principal, community_id, channel_id, "No running".to_string());
    set_channel_rules(
        env,
        user1.principal,
        community_id,
        channel_id,
        "No running or jumping".to_string(),
    );

    let response = send_dummy_message_with_rules(env, &user2, community_id, channel_id, None, Some(Version::from(1)));

    if !matches!(response, community_canister::send_message::Response::RulesNotAccepted) {
        panic!("{response:?}");
    }
}

#[test]
fn send_message_with_rules_leads_to_expected_summary_and_selected_states() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let community_rules = get_community_rules(env, &user2, community_id);
    let channel_rules = get_channel_rules(env, &user2, community_id, channel_id);

    assert_eq!(
        community_rules,
        ChatRules {
            enabled: false,
            accepted: false,
            text: "".to_string(),
            version: Version::zero()
        }
    );

    assert_eq!(
        channel_rules,
        ChatRules {
            enabled: false,
            accepted: false,
            text: "".to_string(),
            version: Version::zero()
        }
    );

    set_community_rules(env, user1.principal, community_id, "No running".to_string());
    set_channel_rules(env, user1.principal, community_id, channel_id, "No jumping".to_string());

    let community_rules = get_community_rules(env, &user2, community_id);
    let channel_rules = get_channel_rules(env, &user2, community_id, channel_id);

    assert_eq!(
        community_rules,
        ChatRules {
            enabled: true,
            accepted: false,
            text: "No running".to_string(),
            version: Version::from(1)
        }
    );

    assert_eq!(
        channel_rules,
        ChatRules {
            enabled: true,
            accepted: false,
            text: "No jumping".to_string(),
            version: Version::from(1)
        }
    );

    send_dummy_message_with_rules(
        env,
        &user2,
        community_id,
        channel_id,
        Some(Version::from(1)),
        Some(Version::from(1)),
    );

    let community_rules = get_community_rules(env, &user2, community_id);
    let channel_rules = get_channel_rules(env, &user2, community_id, channel_id);

    assert_eq!(
        community_rules,
        ChatRules {
            enabled: true,
            accepted: true,
            text: "No running".to_string(),
            version: Version::from(1)
        }
    );

    assert_eq!(
        channel_rules,
        ChatRules {
            enabled: true,
            accepted: true,
            text: "No jumping".to_string(),
            version: Version::from(1)
        }
    );
}

fn get_community_rules(env: &mut PocketIc, user: &User, community_id: CommunityId) -> ChatRules {
    let summary = client::community::happy_path::summary(env, user, community_id);
    let selected = client::community::happy_path::selected_initial(env, user, community_id);

    ChatRules {
        enabled: selected.chat_rules.enabled,
        accepted: summary.membership.unwrap().rules_accepted,
        text: selected.chat_rules.text,
        version: selected.chat_rules.version,
    }
}

fn get_channel_rules(env: &mut PocketIc, user: &User, community_id: CommunityId, channel_id: ChannelId) -> ChatRules {
    let summary = client::community::happy_path::channel_summary(env, user, community_id, channel_id);
    let selected = client::community::happy_path::selected_channel_initial(env, user, community_id, channel_id);

    ChatRules {
        enabled: selected.chat_rules.enabled,
        accepted: summary.membership.unwrap().rules_accepted,
        text: selected.chat_rules.text,
        version: selected.chat_rules.version,
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ChatRules {
    enabled: bool,
    accepted: bool,
    text: String,
    version: Version,
}

fn send_dummy_message_with_rules(
    env: &mut PocketIc,
    sender: &User,
    community_id: CommunityId,
    channel_id: ChannelId,
    community_rules_accepted: Option<Version>,
    channel_rules_accepted: Option<Version>,
) -> community_canister::send_message::Response {
    client::community::send_message(
        env,
        sender.principal,
        community_id.into(),
        &community_canister::send_message::Args {
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            sender_name: sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            community_rules_accepted,
            channel_rules_accepted,
            message_filter_failed: None,
            new_achievement: false,
        },
    )
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);
    client::local_user_index::happy_path::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        None,
    );

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

fn set_community_rules(env: &mut PocketIc, sender: Principal, community_id: CommunityId, text: String) {
    let args = community_canister::update_community::Args {
        name: None,
        description: None,
        rules: Some(UpdatedRules {
            text,
            enabled: true,
            new_version: true,
        }),
        avatar: OptionUpdate::NoChange,
        banner: OptionUpdate::NoChange,
        permissions: None,
        gate_config: OptionUpdate::NoChange,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, sender, community_id, &args);
}

fn set_channel_rules(env: &mut PocketIc, sender: Principal, community_id: CommunityId, channel_id: ChannelId, text: String) {
    let args = community_canister::update_channel::Args {
        name: None,
        description: None,
        rules: Some(UpdatedRules {
            text,
            enabled: true,
            new_version: true,
        }),
        avatar: OptionUpdate::NoChange,
        permissions_v2: None,
        events_ttl: OptionUpdate::NoChange,
        gate_config: OptionUpdate::NoChange,
        public: None,
        channel_id,
        messages_visible_to_non_members: None,
        external_url: OptionUpdate::NoChange,
    };

    client::community::happy_path::update_channel(env, sender, community_id, &args);
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
