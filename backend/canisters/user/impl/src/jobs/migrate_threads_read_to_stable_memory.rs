use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};
use types::MultiUserChat;

const BATCH_SIZE: usize = 1000;
const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Moves the records of how far the user has read each thread in each group and channel from the
// heap into stable memory. This can be removed once every canister has been migrated.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && (state
            .data
            .group_chats
            .iter()
            .any(|g| g.messages_read.threads_read.on_heap_count() > 0)
            || state
                .data
                .communities
                .iter()
                .flat_map(|c| c.channels.values())
                .any(|c| c.messages_read.threads_read.on_heap_count() > 0))
    {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'migrate_threads_read_to_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let mut count = 0;
        let groups = state
            .data
            .group_chats
            .iter_mut()
            .map(|g| (MultiUserChat::Group(g.chat_id), &mut g.messages_read.threads_read));
        let channels = state.data.communities.iter_mut().flat_map(|c| {
            let community_id = c.community_id;
            c.channels.values_mut().map(move |ch| {
                (
                    MultiUserChat::Channel(community_id, ch.channel_id),
                    &mut ch.messages_read.threads_read,
                )
            })
        });

        'outer: for (chat, threads_read) in groups.chain(channels) {
            loop {
                let moved = threads_read.migrate_to_stable_memory(chat, BATCH_SIZE);
                count += moved;
                if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN {
                    break 'outer;
                }
                if moved < BATCH_SIZE {
                    break;
                }
            }
        }
        let complete = !start_job_if_required(state);
        info!(count, complete, "Migrated threads read to stable memory");
    });
}
