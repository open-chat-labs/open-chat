use super::*;
use crate::{
    ChatEvents, DeleteUndeleteMessagesArgs, EditMessageArgs, MessageContentInternal, NullEventPusher, PushMessageArgs,
    TextContentInternal,
};
use candid::Principal;
use ic_stable_structures::DefaultMemoryImpl;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use rand::rngs::StdRng;
use rand::{RngExt, SeedableRng};
use stable_memory_map::{BaseKey, BaseKeyPrefix, ChatEventKeyPrefix};
use types::{ChannelId, Chat, EventContext, MessageId, MultiUserChat, TimestampMillis};

const WORDS: &[&str] = &[
    "apple",
    "application",
    "apply",
    "app",
    "banana",
    "band",
    "Bandana",
    "cat",
    "東京",
    "京都",
    "東京都",
    "こんにちは",
    "日本語",
    "iPhoneを買った",
];

const SEARCH_TERMS: &[&str] = &[
    "app",
    "apple",
    "appl",
    "ban",
    "band",
    "bandana",
    "c",
    "cat",
    "dog",
    "東",
    "京",
    "東京",
    "京都",
    "東京都",
    "こんにち",
    "ちは",
    "日本",
    "iphone",
    "を買",
    "app ban",
    "東京 cat",
    "",
];

type Model = BTreeMap<MessageIndex, (UserId, Vec<String>)>;

#[test]
fn search_matches_model() {
    init_stable_memory_map();
    let mut rng = StdRng::seed_from_u64(1);
    let chats = [
        ChatEventKeyPrefix::new_from_chat(Chat::Direct(user_id(100).into()), None),
        ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None),
        ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None),
        ChatEventKeyPrefix::new_from_chat(Chat::Channel(Principal::anonymous().into(), ChannelId::from(1u32)), None),
        ChatEventKeyPrefix::new_from_chat(Chat::Channel(Principal::anonymous().into(), ChannelId::from(2u32)), None),
    ];
    let mut indexes: Vec<_> = chats.iter().map(|_| SearchIndex::default()).collect();
    let mut models: Vec<_> = chats.iter().map(|_| Model::new()).collect();

    for i in 0..2000u32 {
        let c = rng.random_range(0..chats.len());
        let (chat, index, model) = (&chats[c], &mut indexes[c], &mut models[c]);

        match rng.random_range(0..10) {
            0 | 1 if !model.is_empty() => {
                let message_index = random_key(model, &mut rng);
                let (sender, fields) = model.remove(&message_index).unwrap();
                index.remove(chat, message_index, sender, &document(&fields));
            }
            2 | 3 if !model.is_empty() => {
                let message_index = random_key(model, &mut rng);
                let (sender, fields) = model.get_mut(&message_index).unwrap();
                let new_fields = random_fields(&mut rng);
                index.update(chat, message_index, *sender, &document(fields), &document(&new_fields));
                *fields = new_fields;
            }
            _ => {
                let message_index = MessageIndex::from(i);
                let sender = user_id(rng.random_range(0..4));
                let fields = random_fields(&mut rng);
                index.add(chat, message_index, sender, &document(&fields));
                model.insert(message_index, (sender, fields));
            }
        }

        if i % 10 == 0 {
            for c in 0..chats.len() {
                assert_random_search_matches_model(&chats[c], &indexes[c], &models[c], &mut rng);
            }
        }
    }

    // Removing every message leaves no entries behind
    for c in 0..chats.len() {
        for (message_index, (sender, fields)) in std::mem::take(&mut models[c]) {
            indexes[c].remove(&chats[c], message_index, sender, &document(&fields));
        }
        assert_eq!(stable_entry_count(&chats[c]), 0);
    }
}

#[test]
fn prefix_terms_are_expanded_into_a_limited_number_of_tokens() {
    init_stable_memory_map();
    let chat = ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None);
    let mut index = SearchIndex::default();
    let sender = user_id(1);

    for i in 0..(MAX_PREFIX_EXPANSIONS as u32 + 50) {
        index.add(&chat, i.into(), sender, &document(&[format!("word{i:03}")]));
    }

    let results = index.search(&chat, MessageIndex::default(), "word", &HashSet::new(), usize::MAX);
    let expected: Vec<MessageIndex> = (0..MAX_PREFIX_EXPANSIONS as u32).rev().map(MessageIndex::from).collect();
    assert_eq!(results, expected);

    // An exact match always sorts first, so is always included
    index.add(&chat, 1000.into(), sender, &document(&["word".to_string()]));
    let results = index.search(&chat, MessageIndex::default(), "word", &HashSet::new(), 1);
    assert_eq!(results, vec![MessageIndex::from(1000)]);
}

#[test]
fn prefix_expansions_are_shared_between_terms() {
    init_stable_memory_map();
    let chat = ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None);
    let mut index = SearchIndex::default();
    let sender = user_id(1);

    for i in 0..50u32 {
        index.add(
            &chat,
            i.into(),
            sender,
            &document(&[format!("a{i:02} b{i:02} c{i:02} d{i:02}")]),
        );
    }

    // Each of the 4 terms is expanded into 25 tokens
    let results = index.search(&chat, MessageIndex::default(), "a b c d", &HashSet::new(), usize::MAX);
    let expected: Vec<MessageIndex> = (0..25u32).rev().map(MessageIndex::from).collect();
    assert_eq!(results, expected);
}

#[test]
fn searches_stop_after_a_limited_number_of_seeks() {
    init_stable_memory_map();
    let chat = ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None);
    let mut index = SearchIndex::default();
    let sender = user_id(1);

    // Messages alternate between the two terms, so each step of the intersection skips one message
    // and only the oldest message matches both terms
    let count = MAX_CURSOR_SEEKS as u32;
    index.add(&chat, 0.into(), sender, &document(&["alpha beta".to_string()]));
    for i in 1..count {
        let text = if i % 2 == 0 { "alpha" } else { "beta" };
        index.add(&chat, i.into(), sender, &document(&[text.to_string()]));
    }

    let results = index.search(&chat, MessageIndex::default(), "alpha beta", &HashSet::new(), 10);
    assert!(results.is_empty());

    // Searching from a later message index means fewer seeks, so the match is found
    let min_visible = MessageIndex::from(count - (MAX_CURSOR_SEEKS as u32 / 4));
    index.add(&chat, min_visible, sender, &document(&["alpha beta".to_string()]));
    let results = index.search(&chat, min_visible, "alpha beta", &HashSet::new(), 10);
    assert_eq!(results, vec![min_visible]);
}

#[test]
fn searches_with_no_terms_and_no_users_return_nothing() {
    init_stable_memory_map();
    let chat = ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None);
    let mut index = SearchIndex::default();
    index.add(&chat, 1.into(), user_id(1), &document(&["hello".to_string()]));

    assert!(
        index
            .search(&chat, MessageIndex::default(), "", &HashSet::new(), 10)
            .is_empty()
    );
    assert!(
        index
            .search(&chat, MessageIndex::default(), "?!.", &HashSet::new(), 10)
            .is_empty()
    );
    assert_eq!(
        index.search(&chat, MessageIndex::default(), "?!.", &HashSet::from([user_id(1)]), 10),
        vec![MessageIndex::from(1)]
    );
}

#[test]
fn chat_events_keep_search_index_up_to_date() {
    let mut events = setup_group_events();
    let alice = user_id(1);
    let bob = user_id(2);

    let hello = push(&mut events, alice, "hello world", 10);
    let konnichiwa = push(&mut events, bob, "こんにちは世界", 11);
    let thread_root = push(&mut events, bob, "hello thread", 12);
    push_thread_reply(&mut events, alice, thread_root, "hello from a thread", 13);

    assert_eq!(search(&events, "hello", &[]), vec![thread_root, hello]);
    assert_eq!(search(&events, "hello", &[alice]), vec![hello]);
    assert_eq!(search(&events, "世界", &[]), vec![konnichiwa]);
    assert_eq!(search(&events, "", &[bob]), vec![thread_root, konnichiwa]);

    edit(&mut events, alice, hello, "goodbye world", 20);
    assert_eq!(search(&events, "hello", &[]), vec![thread_root]);
    assert_eq!(search(&events, "good", &[]), vec![hello]);
    assert_eq!(search(&events, "world", &[]), vec![hello]);

    delete(&mut events, bob, konnichiwa, 30);
    assert!(search(&events, "世界", &[]).is_empty());
    assert_eq!(search(&events, "", &[bob]), vec![thread_root]);

    // Editing a deleted message doesn't add it back to the index
    let _ = events.edit_message::<NullEventPusher>(edit_args(bob, konnichiwa, "世界 again", 31), None);
    assert!(search(&events, "世界", &[]).is_empty());

    undelete(&mut events, bob, konnichiwa, 40);
    assert_eq!(search(&events, "世界", &[]), vec![konnichiwa]);

    let event_index = events
        .main_events_list()
        .event_index(EventKey::MessageIndex(konnichiwa))
        .unwrap();
    events.remove_event(event_index, 50).unwrap();
    assert!(search(&events, "世界", &[]).is_empty());
    assert!(search(&events, "", &[bob]).iter().all(|m| *m != konnichiwa));
}

#[test]
fn legacy_heap_entries_are_searchable_then_migrated() {
    let mut events = setup_group_events();
    let chat = events.stable_memory_prefix().clone();
    let senders = [user_id(1), user_id(2), user_id(3)];
    let texts = ["hello world", "apple banana", "hello apple", "東京 tower", "banana split"];

    let mut messages = Vec::new();
    for i in 0..60u64 {
        let sender = senders[i as usize % 3];
        let text = texts[i as usize % texts.len()];
        messages.push((push(&mut events, sender, text, 10 + i), sender, text));
    }

    // Every search term is a whole word, for which the legacy substring search behaves identically
    let queries = [
        ("hello", vec![]),
        ("apple", vec![senders[1]]),
        ("東京", vec![]),
        ("", vec![senders[0]]),
    ];
    let expected: Vec<_> = queries.iter().map(|(q, u)| search(&events, q, u)).collect();

    // Move the older messages onto the heap, plus an entry for a message which no longer exists
    for (message_index, sender, text) in messages.iter().take(40) {
        events
            .search_index_mut()
            .move_to_heap(&chat, *message_index, *sender, document(&[text.to_string()]));
    }
    events
        .search_index_mut()
        .move_to_heap(&chat, 10_000.into(), senders[0], document(&["hello".to_string()]));
    let expected_with_missing: Vec<_> = expected
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let mut e = e.clone();
            if i == 0 || i == 3 {
                e.insert(0, 10_000.into());
            }
            e
        })
        .collect();
    assert_eq!(events.heap_entries_to_migrate_count(), 41);
    assert_searches(&events, &queries, &expected_with_missing);

    // Messages on the heap can still be edited and deleted
    let (edited, edited_sender, _) = messages[1];
    edit(&mut events, edited_sender, edited, "hello there", 100);
    let (deleted, deleted_sender, _) = messages[2];
    delete(&mut events, deleted_sender, deleted, 101);
    assert_eq!(events.heap_entries_to_migrate_count(), 39);
    let expected: Vec<_> = queries.iter().map(|(q, u)| search(&events, q, u)).collect();
    assert!(expected[0].contains(&edited) && !expected[0].contains(&deleted));

    let mut migrated = 0;
    loop {
        migrated += events.migrate_to_stable_memory(10);
        if events.heap_entries_to_migrate_count() == 0 {
            break;
        }
        assert_searches(&events, &queries, &expected);
    }
    assert!(migrated > 39);

    // The entry for the message which no longer exists was dropped
    let expected_without_missing: Vec<_> = expected
        .iter()
        .map(|e| {
            e.iter()
                .copied()
                .filter(|m| *m != MessageIndex::from(10_000))
                .collect::<Vec<_>>()
        })
        .collect();
    assert_searches(&events, &queries, &expected_without_missing);
}

#[test]
fn imported_events_are_indexed() {
    let mut events = setup_group_events();
    let alice = user_id(1);
    let bob = user_id(2);

    let hello = push(&mut events, alice, "hello world", 10);
    let deleted = push(&mut events, bob, "hello deleted", 11);
    let tokyo = push(&mut events, bob, "東京タワー", 12);
    push_thread_reply(&mut events, alice, tokyo, "hello thread", 13);
    delete(&mut events, bob, deleted, 14);
    // Legacy entries, which are re-indexed under the channel's prefix after the import, one of which
    // (as if imported by a version which didn't index imported events) has no entries in the index
    let chat = events.stable_memory_prefix().clone();
    events
        .search_index_mut()
        .move_to_heap(&chat, hello, alice, document(&["hello world".to_string()]));
    events
        .search_index_mut()
        .move_to_heap(&chat, tokyo, bob, document(&["東京タワー".to_string()]));

    let channel = Chat::Channel(Principal::from_slice(&[3]).into(), ChannelId::from(1u32));
    ChatEvents::import_events(channel, export_events(&events));
    let tokyo_document = document(&["東京タワー".to_string()]);
    SearchIndex::default().remove(&ChatEventKeyPrefix::new_from_chat(channel, None), tokyo, bob, &tokyo_document);

    let mut imported: ChatEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
    imported.set_chat(channel);
    imported.discard_message_ids_on_heap();
    imported.discard_expiring_events_on_heap();
    assert_eq!(search(&imported, "タワ", &[]), vec![tokyo]);
    imported.migrate_to_stable_memory(usize::MAX);
    assert_eq!(imported.heap_entries_to_migrate_count(), 0);

    assert_eq!(search(&imported, "hello", &[]), vec![hello]);
    assert_eq!(search(&imported, "タワ", &[]), vec![tokyo]);
    assert_eq!(search(&imported, "", &[bob]), vec![tokyo]);
}

#[test]
fn search_index_is_garbage_collected_with_the_chat() {
    let mut events = setup_group_events();
    push(&mut events, user_id(1), "hello world", 10);

    let prefixes = events.all_stable_memory_key_prefixes();
    let search_prefixes: Vec<BaseKeyPrefix> = vec![
        SearchTokenKeyPrefix::new_from_events_prefix(events.stable_memory_prefix()).into(),
        SearchSenderKeyPrefix::new_from_events_prefix(events.stable_memory_prefix()).into(),
    ];
    for prefix in search_prefixes {
        assert!(prefixes.contains(&prefix));
    }
}

fn assert_random_search_matches_model(chat: &ChatEventKeyPrefix, index: &SearchIndex, model: &Model, rng: &mut StdRng) {
    let search_term = SEARCH_TERMS[rng.random_range(0..SEARCH_TERMS.len())];
    let users: HashSet<_> = (0..rng.random_range(0..3)).map(|_| user_id(rng.random_range(0..5))).collect();
    let min_visible_message_index = MessageIndex::from(if rng.random_bool(0.2) { rng.random_range(0..2000) } else { 0 });
    let max_results = rng.random_range(1..30);

    let terms = query_terms(search_term);
    let expected: Vec<_> = if terms.is_empty() && users.is_empty() {
        Vec::new()
    } else {
        model
            .range(min_visible_message_index..)
            .rev()
            .filter(|(_, (sender, fields))| {
                let tokens = document_tokens(&document(fields));
                (users.is_empty() || users.contains(sender))
                    && terms.iter().all(|term| {
                        tokens
                            .iter()
                            .any(|t| if term.prefix { t.starts_with(&term.token) } else { *t == term.token })
                    })
            })
            .map(|(m, _)| *m)
            .take(max_results)
            .collect()
    };

    let results = index.search(chat, min_visible_message_index, search_term, &users, max_results);
    assert_eq!(
        results, expected,
        "{search_term:?} {users:?} {min_visible_message_index:?} {max_results}"
    );
}

fn assert_searches(events: &ChatEvents, queries: &[(&str, Vec<UserId>)], expected: &[Vec<MessageIndex>]) {
    for ((query, users), expected) in queries.iter().zip(expected) {
        assert_eq!(&search(events, query, users), expected, "{query:?}");
    }
}

fn random_fields(rng: &mut StdRng) -> Vec<String> {
    (0..rng.random_range(1..4))
        .map(|_| {
            (0..rng.random_range(1..5))
                .map(|_| WORDS[rng.random_range(0..WORDS.len())])
                .collect::<Vec<_>>()
                .join([" ", ", ", "/"][rng.random_range(0..3)])
        })
        .collect()
}

fn random_key(model: &Model, rng: &mut StdRng) -> MessageIndex {
    *model.keys().nth(rng.random_range(0..model.len())).unwrap()
}

fn document(fields: &[String]) -> Document {
    let mut document = Document::default();
    for field in fields {
        document.add_field(field);
    }
    document
}

fn stable_entry_count(chat: &ChatEventKeyPrefix) -> usize {
    let token_prefix = SearchTokenKeyPrefix::new_from_events_prefix(chat);
    let sender_prefix = SearchSenderKeyPrefix::new_from_events_prefix(chat);
    with_map(|m| {
        let token_start = SearchTokenKey::try_from(BaseKey::from(BaseKeyPrefix::from(token_prefix.clone()))).unwrap();
        let sender_start = SearchSenderKey::try_from(BaseKey::from(BaseKeyPrefix::from(sender_prefix.clone()))).unwrap();
        let tokens = m
            .range(token_start..)
            .take_while(|(k, _)| k.matches_prefix(&token_prefix))
            .count();
        let senders = m
            .range(sender_start..)
            .take_while(|(k, _)| k.matches_prefix(&sender_prefix))
            .count();
        tokens + senders
    })
}

fn search(events: &ChatEvents, search_term: &str, users: &[UserId]) -> Vec<MessageIndex> {
    events
        .search_messages(
            MessageIndex::default(),
            search_term,
            &users.iter().copied().collect(),
            u8::MAX,
        )
        .into_iter()
        .map(|m| m.message_index)
        .collect()
}

fn push(events: &mut ChatEvents, sender: UserId, text: &str, now: TimestampMillis) -> MessageIndex {
    let message_index = events
        .push_message::<NullEventPusher>(push_args(sender, None, text, now), None)
        .0
        .event
        .message_index;
    MESSAGE_IDS.with_borrow_mut(|m| m.insert(message_index, message_id(now)));
    message_index
}

fn push_thread_reply(events: &mut ChatEvents, sender: UserId, root: MessageIndex, text: &str, now: TimestampMillis) {
    events.push_message::<NullEventPusher>(push_args(sender, Some(root), text, now), None);
}

fn push_args(
    sender: UserId,
    thread_root_message_index: Option<MessageIndex>,
    text: &str,
    now: TimestampMillis,
) -> PushMessageArgs {
    PushMessageArgs {
        sender,
        thread_root_message_index,
        message_id: message_id(now),
        content: text_content(text),
        sender_context: None,
        mentioned: Vec::new(),
        replies_to: None,
        forwarded: false,
        sender_is_bot: false,
        block_level_markdown: false,
        og_previews: Vec::new(),
        now,
    }
}

fn edit(events: &mut ChatEvents, sender: UserId, message_index: MessageIndex, text: &str, now: TimestampMillis) {
    events
        .edit_message::<NullEventPusher>(edit_args(sender, message_index, text, now), None)
        .unwrap();
}

fn edit_args(sender: UserId, message_index: MessageIndex, text: &str, now: TimestampMillis) -> EditMessageArgs {
    EditMessageArgs {
        sender,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index: None,
        message_id: message_id_of(message_index),
        content: text_content(text),
        block_level_markdown: None,
        og_previews: Vec::new(),
        finalise_bot_message: false,
        now,
    }
}

fn delete(events: &mut ChatEvents, caller: UserId, message_index: MessageIndex, now: TimestampMillis) {
    let results = events.delete_messages(delete_args(caller, message_index, now));
    assert!(results.iter().all(|(_, r)| r.is_ok()));
}

fn undelete(events: &mut ChatEvents, caller: UserId, message_index: MessageIndex, now: TimestampMillis) {
    let results = events.undelete_messages(delete_args(caller, message_index, now));
    assert!(results.iter().all(|(_, r)| r.is_ok()));
}

fn delete_args(caller: UserId, message_index: MessageIndex, now: TimestampMillis) -> DeleteUndeleteMessagesArgs {
    DeleteUndeleteMessagesArgs {
        caller,
        is_admin: false,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index: None,
        message_ids: vec![message_id_of(message_index)],
        now,
    }
}

// Message ids are derived from the timestamps the messages were pushed at, which are unique per test
fn message_id(now: TimestampMillis) -> MessageId {
    MessageId::from(now as u128 + 1_000_000)
}

thread_local! {
    static MESSAGE_IDS: std::cell::RefCell<BTreeMap<MessageIndex, MessageId>> = Default::default();
}

fn message_id_of(message_index: MessageIndex) -> MessageId {
    MESSAGE_IDS.with_borrow(|m| *m.get(&message_index).unwrap())
}

fn text_content(text: &str) -> MessageContentInternal {
    MessageContentInternal::Text(TextContentInternal { text: text.to_string() })
}

fn export_events(events: &ChatEvents) -> Vec<(EventContext, serde_bytes::ByteBuf)> {
    let mut exported = Vec::new();
    loop {
        let batch = events.read_events_as_bytes_from_stable_memory(exported.last().map(|(c, _): &(EventContext, _)| c.clone()));
        if batch.is_empty() {
            return exported;
        }
        exported.extend(batch);
    }
}

fn setup_group_events() -> ChatEvents {
    init_stable_memory_map();
    MESSAGE_IDS.with_borrow_mut(|m| m.clear());
    ChatEvents::new_group_chat(
        MultiUserChat::Group(Principal::from_slice(&[1]).into()),
        "name".to_string(),
        "description".to_string(),
        user_id(1),
        None,
        rand::random(),
        1,
    )
}

fn user_id(i: u32) -> UserId {
    Principal::from_slice(&i.to_be_bytes()).into()
}

fn init_stable_memory_map() {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
}
