use crate::canister_id_from_u64;
use canbench_rs::{BenchResult, bench, bench_fn};
use chat_events::{
    AddRemoveReactionArgs, ChatEvents, MessageContentInternal, NullEventPusher, PushMessageArgs, TextContentInternal,
};
use ic_stable_structures::DefaultMemoryImpl;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use types::{ChannelId, Chat, EventIndex, MessageId, MultiUserChat, Reaction, TimestampMillis};

#[bench(raw)]
fn push_simple_text_messages() -> BenchResult {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

    let start = 1700000000000;

    let mut chat_events = ChatEvents::new_group_chat(
        MultiUserChat::Group(canister_id_from_u64(1).into()),
        "abc".to_string(),
        "xyz".to_string(),
        canister_id_from_u64(2).into(),
        None,
        u128::MAX,
        start,
    );

    let args_vec: Vec<_> = (0..1000)
        .map(|i| PushMessageArgs {
            sender: canister_id_from_u64(i).into(),
            thread_root_message_index: None,
            message_id: MessageId::from(u64::MAX - i),
            content: MessageContentInternal::Text(TextContentInternal {
                text: "1".repeat(i as usize),
            }),
            sender_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            now: start + (i * 1000),
        })
        .collect();

    bench_fn(|| {
        for args in args_vec {
            chat_events.push_message::<NullEventPusher>(args, None);
        }
    })
}

#[bench(raw)]
fn add_reactions() -> BenchResult {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

    let start = 1700000000000;

    let mut chat_events = ChatEvents::new_group_chat(
        MultiUserChat::Group(canister_id_from_u64(1).into()),
        "abc".to_string(),
        "xyz".to_string(),
        canister_id_from_u64(2).into(),
        None,
        u128::MAX,
        start,
    );

    let message_id = MessageId::from(u64::MAX);

    chat_events.push_message::<NullEventPusher>(
        PushMessageArgs {
            sender: canister_id_from_u64(1).into(),
            thread_root_message_index: None,
            message_id,
            content: MessageContentInternal::Text(TextContentInternal { text: "1".to_string() }),
            sender_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            now: start,
        },
        None,
    );

    let args_vec: Vec<_> = (0..1000)
        .map(|i| AddRemoveReactionArgs {
            user_id: canister_id_from_u64(i).into(),
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id,
            reaction: Reaction::new((i % 10).to_string()),
            now: start + (i * 1000),
        })
        .collect();

    bench_fn(|| {
        for args in args_vec {
            let _ = chat_events.add_reaction::<NullEventPusher>(args, None);
        }
    })
}

// Imports the events of a group containing 1000 messages into a channel, as happens when a group
// is imported into a community
#[bench(raw)]
fn import_events() -> BenchResult {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

    let start = 1700000000000;
    let chat_events = group_chat_with_messages(1000, start);

    let mut batches = Vec::new();
    let mut after = None;
    loop {
        let batch = chat_events.read_events_as_bytes_from_stable_memory(after);
        let Some((last, _)) = batch.last() else {
            break;
        };
        after = Some(last.clone());
        batches.push(batch);
    }

    let channel = Chat::Channel(canister_id_from_u64(3).into(), ChannelId::from(1u32));

    bench_fn(|| {
        for batch in batches {
            ChatEvents::import_events(channel, batch);
        }
    })
}

// Moves the metrics of 1000 users into stable memory under a channel's prefix, as happens after a
// group is imported into a community
#[bench(raw)]
fn migrate_imported_user_metrics() -> BenchResult {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

    let start = 1700000000000;
    let mut chat_events = group_chat_with_messages(1000, start);
    chat_events.copy_user_metrics_to_heap_for_export();
    chat_events.set_chat(Chat::Channel(canister_id_from_u64(3).into(), ChannelId::from(1u32)));

    bench_fn(|| {
        chat_events.migrate_to_stable_memory(usize::MAX);
    })
}

// A group chat containing `count` messages, each sent by a different user and each with a random
// message id
fn group_chat_with_messages(count: u64, start: TimestampMillis) -> ChatEvents {
    let mut chat_events = ChatEvents::new_group_chat(
        MultiUserChat::Group(canister_id_from_u64(1).into()),
        "abc".to_string(),
        "xyz".to_string(),
        canister_id_from_u64(2).into(),
        None,
        u128::MAX,
        start,
    );

    for i in 0..count {
        chat_events.push_message::<NullEventPusher>(
            PushMessageArgs {
                sender: canister_id_from_u64(i).into(),
                thread_root_message_index: None,
                // Message ids are random, so scramble them
                message_id: MessageId::from((i + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15)),
                content: MessageContentInternal::Text(TextContentInternal {
                    text: "1".repeat(i as usize % 200),
                }),
                sender_context: None,
                mentioned: Vec::new(),
                replies_to: None,
                forwarded: false,
                sender_is_bot: false,
                block_level_markdown: false,
                og_previews: Vec::new(),
                now: start + (i * 1000),
            },
            None,
        );
    }
    chat_events
}
