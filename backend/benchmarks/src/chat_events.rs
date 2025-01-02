use crate::canister_id_from_u64;
use canbench_rs::{bench, bench_fn, BenchResult};
use chat_events::{ChatEvents, MessageContentInternal, PushMessageArgs, TextContentInternal};
use event_store_producer::NullRuntime;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use ic_stable_structures::DefaultMemoryImpl;
use types::{MessageId, MultiUserChat};

#[bench(raw)]
fn push_simple_text_messages() -> BenchResult {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init(memory.get(MemoryId::new(1)));

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
            bot_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            correlation_id: 0,
            now: start + (i * 1000),
        })
        .collect();

    bench_fn(|| {
        for args in args_vec {
            chat_events.push_message::<NullRuntime>(args, None);
        }
    })
}
