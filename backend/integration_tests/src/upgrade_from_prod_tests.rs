use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::{metrics, now_millis, tick_many};
use crate::{TestEnv, User, client, wasms};
use candid::Principal;
use constants::DAY_IN_MS;
use ic_stable_structures::memory_manager::MemoryId;
use pocket_ic::PocketIc;
use stable_memory_map::{KeyType, MapClass};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    BuildVersion, CanisterId, CanisterWasm, ChatEvent, ChatId, CommunityId, Empty, EventIndex, EventWrapper, HttpRequest,
    HttpResponse, MessageContent, MessageId, MessageIndex, OptionUpdate, TimestampMillis, UnitResult, UserId,
};

const STABLE_MEMORY_MAP_MEMORY_ID: MemoryId = MemoryId::new(3);
const STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID: MemoryId = MemoryId::new(4);
// Enough messages for the chat's events to be migrated in several batches of 100
const LARGE_CHAT_MESSAGES: usize = 250;
const SMALL_CHATS: usize = 8;
const SMALL_CHAT_MESSAGES: usize = 3;

// Installs user canisters from the User canister wasm currently in production, fills them with
// direct chats, contacts and blocked users, then upgrades them to the new wasm and checks that everything still
// works.
//
// This currently covers moving the contacts, blocked users, direct chats' unread message indexes and the records of the
// chats the user has been removed from from the heap into
// stable memory, and moving the events of existing direct chats from their legacy stable memory
// keys to their `key_id` based keys, which in test mode migrates a single batch of events per call,
// so the migration is spread across `post_upgrade` and many runs of its timer job.
// TODO: Remove the migration specific checks once every user canister has been migrated
#[test]
fn user_canisters_survive_upgrade_from_prod() {
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
    // Messages which user1 hasn't read yet, for each of which user1 stores the message's index in the
    // sender's copy of the chat
    let unread_chat_user = &small_chat_users[2];
    let recreated_chat_user = &small_chat_users[3];
    for user in [unread_chat_user, recreated_chat_user] {
        for i in 0..SMALL_CHAT_MESSAGES {
            client::user::happy_path::send_text_message(env, user, user1.user_id, i, None);
        }
    }
    tick_many(env, 3);

    let chat_partners: Vec<&User> = std::iter::once(&large_chat_user).chain(&small_chat_users).collect();
    let snapshots: Vec<_> = chat_partners.iter().map(|u| all_events(env, &user1, u.user_id)).collect();
    let large_chat_snapshot_for_them = all_events(env, &large_chat_user, user1.user_id);

    // Contacts, including one for a user user1 has no chat with
    let contacts_snapshot: Vec<_> = small_chat_users
        .iter()
        .take(5)
        .chain(std::iter::once(&large_chat_user))
        .enumerate()
        .map(|(i, user)| (user.user_id, Some(format!("nickname{i}"))))
        .collect();
    for (user_id, nickname) in contacts_snapshot.iter() {
        set_contact(env, &user1, *user_id, OptionUpdate::SetToSome(nickname.clone().unwrap()));
    }
    set_contact(env, &user1, large_chat_user.user_id, OptionUpdate::SetToNone);
    let mut contacts_snapshot: Vec<_> = contacts_snapshot[..5].to_vec();
    contacts_snapshot.sort();
    assert_eq!(contacts(env, &user1), contacts_snapshot);

    // Blocked users, who user1 has no chats with, so that the chats aren't affected
    let blocked: Vec<_> = (0..4).map(|_| client::register_user(env, canister_ids)).collect();
    for user in blocked.iter() {
        client::user::happy_path::block_user(env, &user1, user.user_id);
    }
    client::user::happy_path::unblock_user(env, &user1, blocked[3].user_id);
    let mut blocked_users_snapshot: Vec<_> = blocked[..3].iter().map(|u| u.user_id).collect();
    blocked_users_snapshot.sort();
    assert_eq!(blocked_users(env, &user1), blocked_users_snapshot);
    assert_eq!(snapshots[0].len(), LARGE_CHAT_MESSAGES + 1);
    let total_events: usize = snapshots.iter().map(|s| s.len()).sum();

    // Chats user1 has been removed from: a deleted direct chat, two groups and a community
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let removed_group_ids: Vec<_> = (0..2)
        .map(|_| client::user::happy_path::create_group(env, &owner, &random_string(), true, true))
        .collect();
    let removed_community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    for group_id in removed_group_ids.iter() {
        client::group::happy_path::join_group(env, user1.principal, *group_id);
    }
    client::community::happy_path::join_community(env, user1.principal, removed_community_id);
    let removed_chat_user = client::register_user(env, canister_ids);
    client::user::happy_path::send_text_message(env, &user1, removed_chat_user.user_id, "hi", None);
    tick_many(env, 3);
    let removed_since = now_millis(env);
    env.advance_time(Duration::from_secs(1));
    for group_id in removed_group_ids.iter() {
        client::user::happy_path::leave_group(env, &user1, *group_id);
    }
    client::user::happy_path::leave_community(env, &user1, removed_community_id);
    let response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: removed_chat_user.user_id,
            block_user: false,
        },
    );
    assert!(
        matches!(response, user_canister::delete_direct_chat::Response::Success),
        "{response:?}"
    );
    // Garbage collect the deleted chat's events, so that they aren't included in the key counts below
    env.advance_time(Duration::from_secs(60));
    tick_many(env, 3);
    let mut removed_group_ids_sorted = removed_group_ids.clone();
    removed_group_ids_sorted.sort();
    let removed_snapshot = removed_chats(env, &user1, removed_since);
    assert_eq!(
        removed_snapshot,
        (
            vec![removed_chat_user.user_id.into()],
            removed_group_ids_sorted.clone(),
            vec![removed_community_id]
        )
    );

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

    // The records of the chats user1 was removed from were moved into stable memory
    assert_eq!(removed_chats(env, &user1, removed_since), removed_snapshot);
    assert_eq!(count_keys(env, user1.canister(), KeyType::DirectChatRemoved), 1);
    assert_eq!(count_keys(env, user1.canister(), KeyType::GroupChatRemoved), 2);
    assert_eq!(count_keys(env, user1.canister(), KeyType::CommunityRemoved), 1);

    // A group which is rejoined is no longer returned as removed, until it is left again
    client::group::happy_path::join_group(env, user1.principal, removed_group_ids[0]);
    tick_many(env, 3);
    assert_eq!(removed_chats(env, &user1, removed_since).1, vec![removed_group_ids[1]]);
    env.advance_time(Duration::from_secs(1));
    client::user::happy_path::leave_group(env, &user1, removed_group_ids[0]);
    assert_eq!(removed_chats(env, &user1, removed_since).1, removed_group_ids_sorted);
    assert_eq!(count_keys(env, user1.canister(), KeyType::GroupChatRemoved), 3);

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

    // The unread message indexes were moved into stable memory. User1 hasn't read any of the messages
    // sent by large_chat_user nor the messages sent in the two small chats.
    let mut unread_message_indexes = LARGE_CHAT_MESSAGES / 10 + 2 * SMALL_CHAT_MESSAGES;
    assert_eq!(
        count_keys(env, user1.canister(), KeyType::DirectChatUnreadMessageIndex),
        unread_message_indexes
    );
    // Their messages are indexes 3 to 5 in both copies of the chat, since they were sent after user1's
    assert_eq!(read_by_them_up_to(env, unread_chat_user, user1.user_id), Some(2.into()));

    // Marking messages as read tells the sender and removes their entries
    mark_read(env, &user1, unread_chat_user.user_id, 4.into());
    tick_many(env, 3);
    assert_eq!(read_by_them_up_to(env, unread_chat_user, user1.user_id), Some(4.into()));
    unread_message_indexes -= 2;
    assert_eq!(
        count_keys(env, user1.canister(), KeyType::DirectChatUnreadMessageIndex),
        unread_message_indexes
    );

    // Deleting a chat garbage collects its unread message indexes, but not those of a new chat with
    // the same user which is created before the garbage collection job runs
    let response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: recreated_chat_user.user_id,
            block_user: false,
        },
    );
    assert!(
        matches!(response, user_canister::delete_direct_chat::Response::Success),
        "{response:?}"
    );
    for i in 0..2 {
        client::user::happy_path::send_text_message(env, recreated_chat_user, user1.user_id, i, None);
    }
    tick_many(env, 3);
    env.advance_time(Duration::from_secs(60));
    tick_many(env, 3);
    unread_message_indexes = unread_message_indexes - SMALL_CHAT_MESSAGES + 2;
    assert_eq!(
        count_keys(env, user1.canister(), KeyType::DirectChatUnreadMessageIndex),
        unread_message_indexes
    );

    // In the new chat, the messages are indexes 0 and 1 for user1 but 6 and 7 for the sender, so
    // marking the first as read tells the sender that their message 6 has been read
    assert_eq!(
        read_by_them_up_to(env, recreated_chat_user, user1.user_id),
        Some(MessageIndex::from(SMALL_CHAT_MESSAGES as u32 - 1))
    );
    mark_read(env, &user1, recreated_chat_user.user_id, 0.into());
    tick_many(env, 3);
    assert_eq!(read_by_them_up_to(env, recreated_chat_user, user1.user_id), Some(6.into()));
    unread_message_indexes -= 1;
    assert_eq!(
        count_keys(env, user1.canister(), KeyType::DirectChatUnreadMessageIndex),
        unread_message_indexes
    );

    // The blocked users were moved into stable memory, and can still be blocked and unblocked
    assert_eq!(blocked_users(env, &user1), blocked_users_snapshot);
    assert_eq!(count_keys(env, user1.canister(), KeyType::BlockedUser), 3);
    assert_eq!(
        client::user::happy_path::updates(env, &user1, 0).and_then(|u| u.blocked_users),
        Some(blocked_users_snapshot.clone())
    );
    client::user::happy_path::unblock_user(env, &user1, blocked[0].user_id);
    client::user::happy_path::block_user(env, &user1, blocked[3].user_id);
    let mut expected_blocked_users: Vec<_> = blocked[1..].iter().map(|u| u.user_id).collect();
    expected_blocked_users.sort();
    assert_eq!(blocked_users(env, &user1), expected_blocked_users);
    assert_eq!(count_keys(env, user1.canister(), KeyType::BlockedUser), 3);

    // The contacts were moved into stable memory, and can still be updated
    assert_eq!(contacts(env, &user1), contacts_snapshot);
    assert_eq!(count_keys(env, user1.canister(), KeyType::Contact), contacts_snapshot.len());
    set_contact(
        env,
        &user1,
        small_chat_users[0].user_id,
        OptionUpdate::SetToSome("updated".to_string()),
    );
    set_contact(env, &user1, small_chat_users[1].user_id, OptionUpdate::SetToNone);
    set_contact(
        env,
        &user1,
        large_chat_user.user_id,
        OptionUpdate::SetToSome("new".to_string()),
    );
    let mut expected_contacts: Vec<_> = contacts_snapshot
        .iter()
        .filter(|(user_id, _)| *user_id != small_chat_users[1].user_id)
        .map(|(user_id, nickname)| {
            let nickname = if *user_id == small_chat_users[0].user_id { Some("updated".to_string()) } else { nickname.clone() };
            (*user_id, nickname)
        })
        .chain(std::iter::once((large_chat_user.user_id, Some("new".to_string()))))
        .collect();
    expected_contacts.sort();
    assert_eq!(contacts(env, &user1), expected_contacts);
    assert_eq!(count_keys(env, user1.canister(), KeyType::Contact), expected_contacts.len());

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

fn set_contact(env: &mut PocketIc, user: &User, user_id: UserId, nickname: OptionUpdate<String>) {
    let response = client::user::set_contact(
        env,
        user.principal,
        user.canister(),
        &user_canister::set_contact::Args {
            contact: user_canister::set_contact::OptionalContact { user_id, nickname },
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn mark_read(env: &mut PocketIc, user: &User, them: UserId, read_up_to: MessageIndex) {
    client::user::happy_path::mark_read(
        env,
        user,
        vec![user_canister::mark_read::ChatMessagesRead {
            chat_id: them.into(),
            read_up_to: Some(read_up_to),
            threads: Vec::new(),
            date_read_pinned: None,
        }],
        Vec::new(),
    );
}

// How far the other user has read the user's direct chat with them, as seen by the user
fn read_by_them_up_to(env: &PocketIc, user: &User, them: UserId) -> Option<MessageIndex> {
    client::user::happy_path::initial_state(env, user)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == them)
        .unwrap()
        .read_by_them_up_to
}

// Returns the direct chats, groups and communities the user has been removed from since `since`,
// each ordered by id
fn removed_chats(env: &PocketIc, user: &User, since: TimestampMillis) -> (Vec<ChatId>, Vec<ChatId>, Vec<CommunityId>) {
    let updates = client::user::happy_path::updates(env, user, since).unwrap();
    let mut direct_chats = updates.direct_chats.removed;
    let mut group_chats = updates.group_chats.removed;
    let mut communities = updates.communities.removed;
    direct_chats.sort();
    group_chats.sort();
    communities.sort();
    (direct_chats, group_chats, communities)
}

// Returns the users the user has blocked, ordered by user id
fn blocked_users(env: &PocketIc, user: &User) -> Vec<UserId> {
    let mut blocked_users = client::user::happy_path::initial_state(env, user).blocked_users;
    blocked_users.sort();
    blocked_users
}

// Returns the user's contacts, ordered by user id
fn contacts(env: &PocketIc, user: &User) -> Vec<(UserId, Option<String>)> {
    let user_canister::contacts::Response::Success(result) =
        client::user::contacts(env, user.principal, user.canister(), &Empty {});
    let mut contacts: Vec<_> = result.contacts.into_iter().map(|c| (c.user_id, c.nickname)).collect();
    contacts.sort_by_key(|(user_id, _)| *user_id);
    contacts
}

fn count_keys(env: &PocketIc, canister_id: CanisterId, key_type: KeyType) -> usize {
    let memory_id = match key_type.map_class() {
        MapClass::Default => STABLE_MEMORY_MAP_MEMORY_ID,
        MapClass::SmallEntries => STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID,
    };
    get_stable_memory_map(env, canister_id, memory_id)
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
