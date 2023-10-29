use crate::client::icrc1::happy_path::balance_of;
use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_ledger_types::Tokens;
use ledger_utils::create_pending_transaction;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use types::{
    CanisterId, ChannelId, ChatEvent, CommunityId, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent,
    MessageContentInitial, OptionUpdate, PrizeContentInitial, TextContent, UpdatedRules, Version,
};

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

#[test]
fn send_crypto_in_channel() {
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
            community_rules_accepted: None,
            channel_rules_accepted: None,
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ) {
        let user2_balance = balance_of(env, canister_ids.icp_ledger, user2.user_id.into());
        assert_eq!(user2_balance, 10000);
    } else {
        panic!("{send_message_result:?}")
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

    let inital_user1_balance = balance_of(env, canister_ids.icp_ledger, user1.canister()) as u128;
    let fee = 10000;
    let prizes = vec![Tokens::from_e8s(100000)];
    let total = prizes.iter().map(|t| (t.e8s() as u128) + fee).sum::<u128>();

    let transfer_to: CanisterId = community_id.into();
    let send_message_result = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Prize(PrizeContentInitial {
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    canister_ids.icp_ledger,
                    total,
                    fee,
                    transfer_to.into(),
                    None,
                    now_nanos(env),
                )),
                caption: None,
                prizes,
                end_date: now_millis(env) + 1000,
                diamond_only: false,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            community_rules_accepted: None,
            channel_rules_accepted: None,
        },
    );

    if matches!(
        send_message_result,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ) {
        let user1_balance_after_sending_prize = balance_of(env, canister_ids.icp_ledger, user1.canister()) as u128;
        assert_eq!(user1_balance_after_sending_prize, inital_user1_balance - total - fee);

        let community_balance_after_sending_prize = balance_of(env, canister_ids.icp_ledger, community_id.into()) as u128;
        assert_eq!(community_balance_after_sending_prize, total);

        env.advance_time(Duration::from_secs(2));
        tick_many(env, 5);

        let user1_balance_after_refund = balance_of(env, canister_ids.icp_ledger, user1.canister()) as u128;
        assert_eq!(user1_balance_after_refund, inital_user1_balance - 2 * fee);

        let community_balance_after_refund = balance_of(env, canister_ids.icp_ledger, community_id.into()) as u128;
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
            message_id: random_message_id(),
            content: MessageContentInitial::Text(TextContent { text: "123".to_string() }),
            sender_name: sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            community_rules_accepted,
            channel_rules_accepted,
        },
    )
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
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
        gate: OptionUpdate::NoChange,
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
        gate: OptionUpdate::NoChange,
        public: None,
        channel_id,
    };

    client::community::happy_path::update_channel(env, sender, community_id, &args);
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
