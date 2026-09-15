use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, User, client, wasms};
use candid::Principal;
use constants::DAY_IN_MS;
use ic_stable_structures::memory_manager::MemoryId;
use pocket_ic::PocketIc;
use stable_memory_map::KeyType;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_from_u128;
use types::{
    BuildVersion, CanisterId, CanisterWasm, ChatEvent, EventIndex, EventWrapper, HttpRequest, HttpResponse, MessageContent,
    MessageId, MessageIndex, OptionUpdate, TimestampMillis, UserId,
};

const STABLE_MEMORY_MAP_MEMORY_ID: MemoryId = MemoryId::new(3);
// Enough messages for the chat's events to be migrated in several batches of 100
const LARGE_CHAT_MESSAGES: usize = 250;
const SMALL_CHATS: usize = 8;
const SMALL_CHAT_MESSAGES: usize = 3;

// Installs user canisters from the User canister wasm currently in production, fills them with
// direct chats, then upgrades them to the new wasm and checks that everything still works.
//
// This currently covers moving the events of existing direct chats from their legacy stable memory
// keys to their `key_id` based keys, which in test mode migrates a single batch of events per call,
// so the migration is spread across `post_upgrade` and many runs of its timer job.
// TODO: Remove the migration specific checks once every user canister has been migrated
#[test]
fn direct_chats_survive_upgrade_from_prod() {
    // Installing the prod wasm would downgrade the user canisters of any other test drawing a pooled
    // env, so use a new one
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let prod_version = BuildVersion::new(0, 0, 1);
    let new_version = BuildVersion::new(0, 0, 2);
    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: prod_version,
            module: wasms::USER_PROD.module.clone(),
        },
    );
    tick_many(env, 3);

    let user1 = client::register_user(env, canister_ids);
    let large_chat_user = client::register_user(env, canister_ids);
    let small_chat_users: Vec<_> = (0..SMALL_CHATS).map(|_| client::register_user(env, canister_ids)).collect();
    for user in std::iter::once(&user1).chain(&small_chat_users) {
        assert_eq!(wasm_version(env, user.canister()), prod_version);
    }

    // A chat whose events span several batches, with some messages sent by each user, and some
    // messages edited, reacted to and deleted
    let mut large_chat_message_ids = Vec::new();
    for i in 0..LARGE_CHAT_MESSAGES {
        let message_id: MessageId = random_from_u128();
        if i % 10 == 9 {
            client::user::happy_path::send_text_message(env, &large_chat_user, user1.user_id, i, Some(message_id));
        } else {
            client::user::happy_path::send_text_message(env, &user1, large_chat_user.user_id, i, Some(message_id));
        }
        large_chat_message_ids.push(message_id);
    }
    client::user::happy_path::edit_text_message(
        env,
        &user1,
        large_chat_user.user_id,
        large_chat_message_ids[5],
        "edited",
        None,
    );
    client::user::happy_path::edit_text_message(
        env,
        &user1,
        large_chat_user.user_id,
        large_chat_message_ids[240],
        "edited",
        None,
    );
    client::user::happy_path::add_reaction(env, &large_chat_user, user1.user_id, "👍", large_chat_message_ids[150]);
    delete_message(env, &user1, large_chat_user.user_id, large_chat_message_ids[200]);

    // Many chats which each fit within a single batch, the first of which has disappearing messages
    client::user::happy_path::update_chat_settings(
        env,
        &user1,
        &user_canister::update_chat_settings::Args {
            user_id: small_chat_users[0].user_id,
            events_ttl: OptionUpdate::SetToSome(DAY_IN_MS),
        },
    );
    for user in small_chat_users.iter() {
        for i in 0..SMALL_CHAT_MESSAGES {
            client::user::happy_path::send_text_message(env, &user1, user.user_id, i, None);
        }
    }
    tick_many(env, 3);

    let chat_partners: Vec<&User> = std::iter::once(&large_chat_user).chain(&small_chat_users).collect();
    let snapshots: Vec<_> = chat_partners.iter().map(|u| all_events(env, &user1, u.user_id)).collect();
    let large_chat_snapshot_for_them = all_events(env, &large_chat_user, user1.user_id);
    assert_eq!(snapshots[0].len(), LARGE_CHAT_MESSAGES + 1);
    let total_events: usize = snapshots.iter().map(|s| s.len()).sum();

    // The prod wasm stores direct chat events under keys based on the other user's id. User1 also has
    // a chat with the OpenChat bot, whose events are included in the key counts.
    let total_keys = count_keys(env, user1.canister(), KeyType::DirectChatEventLegacy);
    assert!(total_keys > total_events, "{total_keys} {total_events}");
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatEvent), 0);

    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: new_version,
            module: wasms::USER.module.clone(),
        },
    );

    // Tick one round at a time, checking that every event stays readable while being migrated
    let mut chats_with_legacy_events = Vec::new();
    for _ in 0..500 {
        env.tick();
        // The canister is briefly stopped while being upgraded, during which queries are rejected
        if try_wasm_version(env, user1.canister()) != Some(new_version) {
            continue;
        }
        let remaining = direct_chats_with_legacy_events(env, user1.canister());
        chats_with_legacy_events.push(remaining);
        for (user, snapshot) in chat_partners.iter().zip(snapshots.iter()) {
            assert_eq!(&all_events(env, &user1, user.user_id), snapshot, "remaining: {remaining}");
        }
        if remaining == 0 {
            break;
        }
    }

    // `post_upgrade` only migrates a single batch in test mode, so every chat but at most one still
    // has legacy events when the upgrade completes, and the rest are migrated by the timer job
    assert!(
        chats_with_legacy_events.first().is_some_and(|c| *c >= SMALL_CHATS),
        "{chats_with_legacy_events:?}"
    );
    assert!(
        chats_with_legacy_events.is_sorted_by(|a, b| a >= b),
        "{chats_with_legacy_events:?}"
    );
    assert_eq!(chats_with_legacy_events.last(), Some(&0), "{chats_with_legacy_events:?}");
    assert!(chats_with_legacy_events.len() > 2, "{chats_with_legacy_events:?}");

    // Every event is now stored under the `key_id` based keys
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatEventLegacy), 0);
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatThreadEventLegacy), 0);
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatEvent), total_keys);

    tick_many(env, 10);
    assert_eq!(wasm_version(env, large_chat_user.canister()), new_version);
    assert_eq!(direct_chats_with_legacy_events(env, large_chat_user.canister()), 0);
    assert_eq!(all_events(env, &large_chat_user, user1.user_id), large_chat_snapshot_for_them);

    // Migrated messages can still be updated, and new messages sent
    client::user::happy_path::edit_text_message(
        env,
        &user1,
        large_chat_user.user_id,
        large_chat_message_ids[6],
        "edited",
        None,
    );
    client::user::happy_path::add_reaction(env, &user1, large_chat_user.user_id, "🎉", large_chat_message_ids[7]);
    let new_message = client::user::happy_path::send_text_message(env, &user1, large_chat_user.user_id, "new", None);
    tick_many(env, 3);

    let events = all_events(env, &user1, large_chat_user.user_id);
    assert_eq!(events.len(), LARGE_CHAT_MESSAGES + 2);
    let message = |index: usize| events[index + 1].message.as_ref().unwrap();
    assert!(message(6).edited);
    assert_eq!(message(6).text.as_deref(), Some("edited"));
    assert_eq!(message(7).reactions, 1);
    assert_eq!(message(LARGE_CHAT_MESSAGES).text.as_deref(), Some("new"));
    assert_eq!(events.last().unwrap().index, new_message.event_index);
    for (i, event) in events
        .iter()
        .enumerate()
        .filter(|(i, _)| ![7, 8, LARGE_CHAT_MESSAGES + 1].contains(i))
    {
        assert_eq!(event, &snapshots[0][i]);
    }
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatEvent), total_keys + 1);

    // Deleting a migrated chat garbage collects its events
    let deleted_chat_user = &small_chat_users[1];
    let response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: deleted_chat_user.user_id,
            block_user: false,
        },
    );
    assert!(
        matches!(response, user_canister::delete_direct_chat::Response::Success),
        "{response:?}"
    );
    env.advance_time(Duration::from_secs(60));
    tick_many(env, 3);
    assert_eq!(
        count_keys(env, user1.canister(), KeyType::DirectChatEvent),
        total_keys + 1 - snapshots[2].len()
    );

    // Messages which were set to disappear before the upgrade still do so
    let disappearing_chat_user = &small_chat_users[0];
    let first_message_index = snapshots[1].iter().find(|e| e.message.is_some()).unwrap().index;
    assert!(
        !client::user::happy_path::events_by_index(env, &user1, disappearing_chat_user.user_id, vec![first_message_index])
            .events
            .is_empty()
    );
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    tick_many(env, 3);
    let response =
        client::user::happy_path::events_by_index(env, &user1, disappearing_chat_user.user_id, vec![first_message_index]);
    assert!(response.events.is_empty());
    assert!(!response.expired_event_ranges.is_empty());

    // The env has been significantly altered, so it mustn't be reused by other tests
    wrapper.discard();
}

#[derive(Debug, PartialEq, Eq)]
struct EventSummary {
    index: EventIndex,
    timestamp: TimestampMillis,
    expires_at: Option<TimestampMillis>,
    message: Option<MessageSummary>,
}

#[derive(Debug, PartialEq, Eq)]
struct MessageSummary {
    message_index: MessageIndex,
    message_id: MessageId,
    sender: UserId,
    text: Option<String>,
    deleted: bool,
    edited: bool,
    reactions: usize,
}

impl From<EventWrapper<ChatEvent>> for EventSummary {
    fn from(event: EventWrapper<ChatEvent>) -> Self {
        EventSummary {
            index: event.index,
            timestamp: event.timestamp,
            expires_at: event.expires_at,
            message: match event.event {
                ChatEvent::Message(m) => Some(MessageSummary {
                    message_index: m.message_index,
                    message_id: m.message_id,
                    sender: m.sender,
                    text: match &m.content {
                        MessageContent::Text(t) => Some(t.text.clone()),
                        _ => None,
                    },
                    deleted: matches!(m.content, MessageContent::Deleted(_)),
                    edited: m.edited,
                    reactions: m.reactions.len(),
                }),
                _ => None,
            },
        }
    }
}

// Reads every event in the chat, in pages
fn all_events(env: &PocketIc, user: &User, them: UserId) -> Vec<EventSummary> {
    let mut events = Vec::new();
    let mut start_index = EventIndex::default();
    loop {
        let response = client::user::happy_path::events(env, user, them, start_index, true, 100, 100);
        let Some(last_index) = response.events.last().map(|e| e.index) else {
            break;
        };
        events.extend(response.events.into_iter().map(EventSummary::from));
        if last_index >= response.latest_event_index {
            break;
        }
        start_index = last_index.incr();
    }
    events
}

fn delete_message(env: &mut PocketIc, user: &User, them: UserId, message_id: MessageId) {
    let response = client::user::delete_messages(
        env,
        user.principal,
        user.canister(),
        &user_canister::delete_messages::Args {
            user_id: them,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(
        matches!(response, user_canister::delete_messages::Response::Success),
        "{response:?}"
    );
}

fn count_keys(env: &PocketIc, canister_id: CanisterId, key_type: KeyType) -> usize {
    get_stable_memory_map(env, canister_id, STABLE_MEMORY_MAP_MEMORY_ID)
        .keys()
        .filter(|k| k[0] == key_type as u8)
        .count()
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

fn try_wasm_version(env: &PocketIc, canister_id: CanisterId) -> Option<BuildVersion> {
    let request = HttpRequest {
        method: "GET".to_string(),
        url: "/metrics".to_string(),
        headers: Vec::new(),
        body: Vec::new(),
    };
    let bytes = env
        .query_call(
            canister_id,
            Principal::anonymous(),
            "http_request",
            candid::encode_one(&request).unwrap(),
        )
        .ok()?;
    let response: HttpResponse = candid::decode_one(&bytes).unwrap();
    let metrics: serde_json::Value = serde_json::from_slice(&response.body).unwrap();
    Some(serde_json::from_value(metrics["wasm_version"].clone()).unwrap())
}

fn direct_chats_with_legacy_events(env: &PocketIc, canister_id: CanisterId) -> usize {
    serde_json::from_value(metrics(env, canister_id)["direct_chats_with_legacy_events"].clone()).unwrap()
}
